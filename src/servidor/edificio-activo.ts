import "server-only";
import { cookies } from "next/headers";
import { COOKIE_EDIFICIO, type UsuarioActual } from "./sesion";

/** Guarda el edificio con el que trabaja el usuario (solo si es uno de los suyos). */
export async function elegirEdificioActivo(usuario: UsuarioActual, edificioId: string): Promise<boolean> {
  if (!usuario.edificios.some((e) => e.id === edificioId)) return false;
  const c = await cookies();
  c.set(COOKIE_EDIFICIO, edificioId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // La unidad activa era de otro edificio: se vuelve a la primera del nuevo.
  c.delete("unidad_activa");
  return true;
}
