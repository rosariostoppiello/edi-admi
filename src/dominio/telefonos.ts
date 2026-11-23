/** Teléfonos y datos de interés (C.5): enlaces para llamar y vencimiento del seguro. Lógica pura. */

/** Enlace tel: con solo dígitos (y + inicial). Los fijos de Montevideo y celulares se marcan tal cual. */
export function enlaceTelefono(texto: string): string | null {
  const t = texto.trim();
  const digitos = t.replace(/[^\d]/g, "");
  if (digitos.length < 3) return null;
  return `tel:${t.startsWith("+") ? "+" : ""}${digitos}`;
}

/** Separa "099 123 456 / 2901 2345" en teléfonos sueltos para tener un botón de llamar por cada uno. */
export function separarTelefonos(texto: string): string[] {
  return texto
    .split(/\s*(?:\/|,|;|\by\b|\bo\b)\s*/)
    .map((t) => t.trim())
    .filter((t) => t.replace(/[^\d]/g, "").length >= 3);
}

export const DIAS_AVISO_VENCIMIENTO = 30;

/** Días que faltan desde `hoy` hasta `hasta` (fechas "AAAA-MM-DD"); negativo si ya venció. */
export function diasParaVencer(hoy: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000);
}

export type EstadoPoliza = "VIGENTE" | "POR_VENCER" | "VENCIDA";

export function estadoPoliza(hoy: string, hasta: string): EstadoPoliza {
  const d = diasParaVencer(hoy, hasta);
  if (d < 0) return "VENCIDA";
  if (d <= DIAS_AVISO_VENCIMIENTO) return "POR_VENCER";
  return "VIGENTE";
}

/** Frase para el aviso: "vence hoy", "vence mañana", "vence en 12 días", "venció hace 3 días". */
export function fraseVencimiento(hoy: string, hasta: string): string {
  const d = diasParaVencer(hoy, hasta);
  if (d === 0) return "vence hoy";
  if (d === 1) return "vence mañana";
  if (d > 1) return `vence en ${d} días`;
  return d === -1 ? "venció ayer" : `venció hace ${-d} días`;
}
