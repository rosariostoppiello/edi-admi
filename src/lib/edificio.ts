import { formatearCodigo, type Sufijo } from "@/dominio/codigos";
import type { Calidad, Rol } from "@/dominio/permisos";

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

/** Color de marca de una torre (guardado en la torre, docs/design.md); sin color, gris. */
export function colorTorre(color: string | null | undefined): string {
  return color || "var(--torre-garajes)";
}
