import "server-only";
import { cookies } from "next/headers";
import type { UsuarioActual } from "./sesion";

const COOKIE = "unidad_activa";

/**
 * Unidad con la que está trabajando el usuario (si tiene varias, ej. apto + garaje).
 * El valor de la cookie se valida siempre contra las unidades del usuario:
 * nunca da acceso a una unidad ajena.
 */
export async function unidadActiva(usuario: UsuarioActual) {
  if (usuario.unidadesDetalle.length === 0) return null;
  const elegida = (await cookies()).get(COOKIE)?.value;
  return usuario.unidadesDetalle.find((u) => u.unidadId === elegida) ?? usuario.unidadesDetalle[0];
}

export async function elegirUnidadActiva(usuario: UsuarioActual, unidadId: string): Promise<boolean> {
  if (!usuario.unidadesDetalle.some((u) => u.unidadId === unidadId)) return false;
  (await cookies()).set(COOKIE, unidadId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return true;
}
