import "server-only";
import { db } from "./db";
import type { Rol } from "@/dominio/permisos";

/** Edificios activos, para los formularios públicos (sin sesión). Solo nombre: no son datos personales. */
export async function edificiosActivos() {
  return db.edificio.findMany({ where: { estado: "ACTIVO" }, select: { id: true, nombre: true }, orderBy: { creadoEn: "asc" } });
}

/** Selección para mostrar el código de una unidad ("2-201"): el número de torre que ve la gente. */
export const SELECCION_CODIGO = { numero: true, torre: { select: { numero: true } } } as const;

/** "2-201", "2-201-A" o "2 201" → unidad activa de ese edificio. */
export async function unidadPorCodigo(edificioId: string, texto: string) {
  const m = /^(\d{1,3})[\s-]+([0-9A-Za-z]{1,6})(?:[\s-]*[APIapi])?$/.exec(texto.trim());
  if (!m) return null;
  return db.unidad.findFirst({
    where: { edificioId, numero: m[2].toUpperCase(), activa: true, torre: { numero: Number(m[1]) } },
    select: { id: true, ...SELECCION_CODIGO },
  });
}

/** Mails del equipo de un edificio (Administración, Comisión o Portería) para avisos. */
export async function equipoDelEdificio(edificioId: string, roles: Exclude<Rol, "UNIDAD">[]) {
  const m = await db.membresia.findMany({
    where: { edificioId, rol: { in: roles }, user: { activo: true } },
    select: { user: { select: { email: true } } },
  });
  return m.map((x) => ({ email: x.user.email }));
}
