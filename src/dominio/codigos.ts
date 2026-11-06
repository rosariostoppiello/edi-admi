/**
 * Códigos de línea de liquidación: "{torre}-{numero}-{A|P|I}", ej. "2-201-P".
 * A = unidad no arrendada (un solo responsable).
 * P = propietario / promitente comprador, I = inquilino (unidad arrendada).
 */

export type Sufijo = "A" | "P" | "I";

export interface CodigoUnidad {
  torre: number;
  numero: string;
  sufijo: Sufijo;
}

const REGEX = /^(\d{1,3})-([0-9A-Za-z]{1,6})-([API])$/;

export function formatearCodigo({ torre, numero, sufijo }: CodigoUnidad): string {
  return `${torre}-${numero}-${sufijo}`;
}

/** Acepta "2-201-P", "2-201P", "2 201 p" y devuelve el código normalizado, o null. */
export function parsearCodigo(texto: string): CodigoUnidad | null {
  const limpio = texto
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/^(\d+-[0-9A-Z]+?)([API])$/, "$1-$2");
  const m = REGEX.exec(limpio);
  if (!m) return null;
  return { torre: Number(m[1]), numero: m[2], sufijo: m[3] as Sufijo };
}

/** Sufijos que tiene una unidad según si está arrendada. */
export function sufijosDeUnidad(arrendada: boolean): Sufijo[] {
  return arrendada ? ["P", "I"] : ["A"];
}

/** Código de la unidad sin sufijo, para mostrar: "2-201". */
export function codigoBase(torre: number, numero: string): string {
  return `${torre}-${numero}`;
}
