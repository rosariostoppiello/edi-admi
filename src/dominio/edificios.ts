/** Reglas de varios edificios (decisiones 85 y 86). Lógica pura, sin DB. */
import type { Rol } from "./permisos";

export interface EdificioDisponible {
  id: string;
  nombre: string;
}

/**
 * Edificio con el que trabaja el usuario: el que eligió (si sigue siendo suyo) o, si
 * tiene uno solo, ese. `elegido` es false cuando tiene varios y todavía no eligió:
 * entonces se le muestra la pantalla para elegir.
 */
export function resolverEdificioActivo<E extends EdificioDisponible>(
  disponibles: E[],
  cookie: string | undefined,
): { edificio: E | null; elegido: boolean } {
  if (disponibles.length === 0) return { edificio: null, elegido: false };
  const delCookie = disponibles.find((e) => e.id === cookie);
  if (delCookie) return { edificio: delCookie, elegido: true };
  return { edificio: disponibles[0], elegido: disponibles.length === 1 };
}

/** Rol en un edificio: el de su membresía o, si solo tiene unidades ahí, "UNIDAD". */
export function rolEnEdificio(membresias: { edificioId: string; rol: Rol }[], edificioId: string): Rol {
  return membresias.find((m) => m.edificioId === edificioId)?.rol ?? "UNIDAD";
}

/** Edificios de un usuario, sin repetir: los de sus membresías y los de sus unidades. */
export function edificiosDelUsuario(membresias: { edificioId: string }[], unidades: { edificioId: string }[]): string[] {
  return [...new Set([...membresias.map((m) => m.edificioId), ...unidades.map((u) => u.edificioId)])];
}
