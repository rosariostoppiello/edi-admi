import { formatearCodigo, type Sufijo } from "@/dominio/codigos";
import type { Calidad, Rol } from "@/dominio/permisos";

export const NOMBRE_COMPLEJO = process.env.EDIFICIO_NOMBRE ?? "Complejo";

/** Sufijo de la línea de liquidación que le corresponde a una persona. */
export function sufijoDePersona(arrendada: boolean, calidad: Calidad): Sufijo {
  if (!arrendada) return "A";
  return calidad === "INQUILINO" ? "I" : "P";
}

export function codigoDePersona(u: {
  torre: number;
  numero: string;
  arrendada: boolean;
  calidad: Calidad;
}): string {
  return formatearCodigo({ torre: u.torre, numero: u.numero, sufijo: sufijoDePersona(u.arrendada, u.calidad) });
}

export const NOMBRE_ROL: Record<Rol, string> = {
  ADMINISTRACION: "Administración",
  COMISION: "Comisión administradora",
  PORTERIA: "Portería",
  UNIDAD: "Unidad",
};

/** Color de marca de cada torre (código → variable CSS). Ver docs/design.md. */
export const COLOR_TORRE: Record<number, string> = {
  2: "var(--torre-avenue)",
  3: "var(--torre-sky)",
  4: "var(--torre-pilay)",
  5: "var(--torre-ne)",
  6: "var(--torre-garajes)",
};
