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

/** Módulos que un edificio puede prender o apagar (Datos está siempre). */
export const MODULOS_CONFIGURABLES = ["/liquidaciones", "/reservas", "/solicitudes", "/comunicados", "/telefonos"] as const;

/**
 * Lista a guardar: si están todos prendidos se guarda vacía (así un módulo nuevo del
 * sistema aparece solo en los edificios que no eligieron).
 */
export function modulosAGuardar(elegidos: string[]): string[] {
  const validos = MODULOS_CONFIGURABLES.filter((m) => elegidos.includes(m));
  return validos.length === MODULOS_CONFIGURABLES.length ? [] : [...validos];
}

/**
 * Torres de un edificio nuevo, una por línea: "1 Norte", "2" o "Torre 3 Sur".
 * Devuelve el error de la primera línea mal escrita.
 */
export function leerTorres(texto: string): { torres: { numero: number; nombre: string }[] } | { error: string } {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas.length === 0) return { error: "Escribí al menos una torre (ej. 1 Única)." };
  if (lineas.length > 30) return { error: "Son demasiadas torres (máximo 30)." };
  const torres: { numero: number; nombre: string }[] = [];
  for (const l of lineas) {
    const m = /^(?:torre\s+)?(\d{1,3})(?:\s*[-–:]?\s*(.{1,40}))?$/i.exec(l);
    if (!m) return { error: `No entendimos "${l}". Escribí el número y, si querés, el nombre (ej. 1 Norte).` };
    const numero = Number(m[1]);
    if (torres.some((t) => t.numero === numero)) return { error: `La torre ${numero} está repetida.` };
    torres.push({ numero, nombre: m[2]?.trim() || `Torre ${numero}` });
  }
  return { torres };
}
