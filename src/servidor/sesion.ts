import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { ErrorPermiso, puede, type Accion, type Actor, type Recurso, type Rol } from "@/dominio/permisos";

export interface UsuarioActual extends Actor {
  nombre: string;
  email: string;
  /** Unidades vinculadas, con datos para mostrar (código, torre). */
  unidadesDetalle: {
    unidadId: string;
    torre: number;
    torreNombre: string;
    numero: string;
    arrendada: boolean;
    calidad: Actor["unidades"][number]["calidad"];
  }[];
}

/**
 * Capa de acceso a la sesión (DAL). Lee la sesión de Better Auth y arma el
 * Actor con sus unidades vinculadas. Memoizado por request.
 */
export const obtenerUsuario = cache(async (): Promise<UsuarioActual | null> => {
  const sesion = await auth.api.getSession({ headers: await headers() });
  if (!sesion) return null;

  const user = await db.user.findUnique({
    where: { id: sesion.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      rol: true,
      activo: true,
      personas: {
        where: { activa: true, unidad: { activa: true } },
        select: {
          id: true,
          calidad: true,
          unidad: {
            select: {
              id: true,
              numero: true,
              arrendada: true,
              torre: { select: { codigo: true, nombre: true } },
            },
          },
        },
        orderBy: [{ unidad: { torreId: "asc" } }, { unidad: { numero: "asc" } }],
      },
    },
  });
  if (!user || !user.activo) return null;

  return {
    userId: user.id,
    rol: user.rol as Rol,
    nombre: user.name,
    email: user.email,
    unidades: user.personas.map((p) => ({
      unidadId: p.unidad.id,
      personaId: p.id,
      calidad: p.calidad,
    })),
    unidadesDetalle: user.personas.map((p) => ({
      unidadId: p.unidad.id,
      torre: p.unidad.torre.codigo,
      torreNombre: p.unidad.torre.nombre,
      numero: p.unidad.numero,
      arrendada: p.unidad.arrendada,
      calidad: p.calidad,
    })),
  };
});

/** Para páginas: exige sesión o redirige al login. */
export async function exigirUsuario(): Promise<UsuarioActual> {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingresar");
  return usuario;
}

/**
 * Para server actions y endpoints: exige sesión Y permiso.
 * Lanza ErrorPermiso si no corresponde (nunca confiar en la UI).
 */
export async function exigirPermiso(accion: Accion, recurso?: Recurso): Promise<UsuarioActual> {
  const usuario = await exigirUsuario();
  if (!puede(usuario, accion, recurso)) throw new ErrorPermiso(accion);
  return usuario;
}
