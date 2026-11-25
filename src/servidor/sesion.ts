import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { ErrorPermiso, puede, type Accion, type Actor, type Recurso, type Rol } from "@/dominio/permisos";
import { edificiosDelUsuario, resolverEdificioActivo, rolEnEdificio } from "@/dominio/edificios";

/** Edificio con el que está trabajando el usuario (decisión 85). */
export interface EdificioActivo {
  id: string;
  nombre: string;
  direccion: string;
  modulos: string[];
}

export const COOKIE_EDIFICIO = "edificio_activo";

export interface UsuarioActual extends Actor {
  nombre: string;
  email: string;
  /** Edificio activo: rol y unidades son los de este edificio. */
  edificio: EdificioActivo;
  /** Todos los edificios del usuario (para elegir o cambiar). */
  edificios: { id: string; nombre: string }[];
  /** false si tiene varios edificios y todavía no eligió con cuál trabajar. */
  edificioElegido: boolean;
  /** Dueño del sistema: aprueba los edificios nuevos (no es un rol de edificio). */
  duenoSistema: boolean;
  /** Unidades vinculadas, con datos para mostrar (código, torre). */
  unidadesDetalle: {
    unidadId: string;
    /** Número de torre que ve la gente (no es la clave interna `torreId`). */
    torre: number;
    torreNombre: string;
    numero: string;
    tipo: "APTO" | "LOCAL" | "GARAJE" | "OFICINA";
    arrendada: boolean;
    calidad: Actor["unidades"][number]["calidad"];
    datosConfirmados: boolean;
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
      duenoSistema: true,
      activo: true,
      membresias: { select: { edificioId: true, rol: true } },
      personas: {
        where: { activa: true, unidad: { activa: true } },
        select: {
          id: true,
          calidad: true,
          datosConfirmadosEn: true,
          unidad: {
            select: {
              id: true,
              edificioId: true,
              numero: true,
              tipo: true,
              arrendada: true,
              torre: { select: { numero: true, nombre: true } },
            },
          },
        },
        orderBy: [{ unidad: { torreId: "asc" } }, { unidad: { numero: "asc" } }],
      },
    },
  });
  if (!user || !user.activo) return null;

  // Edificios del usuario: los de sus membresías (Administración, Comisión, Portería)
  // y los de sus unidades. Solo los edificios activos.
  const ids = edificiosDelUsuario(user.membresias, user.personas.map((p) => p.unidad));
  const edificios = await db.edificio.findMany({
    where: { id: { in: ids }, estado: "ACTIVO" },
    select: { id: true, nombre: true, direccion: true, modulos: true },
    orderBy: { creadoEn: "asc" },
  });
  // La cookie es "usuario:edificio": la elección de otra persona en el mismo navegador no vale.
  const [dueno, elegidoId] = ((await cookies()).get(COOKIE_EDIFICIO)?.value ?? "").split(":");
  const { edificio, elegido } = resolverEdificioActivo(edificios, dueno === user.id ? elegidoId : undefined);
  if (!edificio) return null;
  const personas = user.personas.filter((p) => p.unidad.edificioId === edificio.id);

  return {
    userId: user.id,
    rol: rolEnEdificio(user.membresias as { edificioId: string; rol: Rol }[], edificio.id),
    duenoSistema: user.duenoSistema,
    edificioElegido: elegido,
    nombre: user.name,
    email: user.email,
    edificio,
    edificios: edificios.map((e) => ({ id: e.id, nombre: e.nombre })),
    unidades: personas.map((p) => ({
      unidadId: p.unidad.id,
      personaId: p.id,
      calidad: p.calidad,
    })),
    unidadesDetalle: personas.map((p) => ({
      unidadId: p.unidad.id,
      torre: p.unidad.torre.numero,
      torreNombre: p.unidad.torre.nombre,
      numero: p.unidad.numero,
      tipo: p.unidad.tipo,
      arrendada: p.unidad.arrendada,
      calidad: p.calidad,
      datosConfirmados: p.datosConfirmadosEn !== null,
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
  // Administración y Portería actúan sobre cualquier unidad, pero solo de su edificio
  // activo (las unidades propias ya vienen filtradas por edificio en el Actor).
  if (recurso?.unidadId && !usuario.unidades.some((u) => u.unidadId === recurso.unidadId)) {
    const unidad = await db.unidad.findUnique({ where: { id: recurso.unidadId }, select: { edificioId: true } });
    if (unidad?.edificioId !== usuario.edificio.id) throw new ErrorPermiso(accion);
  }
  return usuario;
}
