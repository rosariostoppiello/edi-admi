/**
 * Solicitudes varias (C.3): categorías, estados y el enlace de WhatsApp.
 * Lógica pura, sin DB.
 */

export type Categoria = "DESPERFECTO" | "CONSULTA_GC" | "INQUIETUD" | "VENTA_UNIDAD";
export type EstadoSolicitud = "NUEVA" | "EN_CURSO" | "RESUELTA";

/** Las tres categorías que se crean desde Solicitudes, con su ruta (en el orden del gráfico). */
export const CATEGORIAS_PUBLICAS = [
  { slug: "desperfectos", categoria: "DESPERFECTO", nombre: "Aviso de desperfectos", corto: "Desperfecto" },
  { slug: "consultas", categoria: "CONSULTA_GC", nombre: "Consultas de gastos comunes", corto: "Consulta de gastos comunes" },
  { slug: "inquietudes", categoria: "INQUIETUD", nombre: "Inquietudes varias", corto: "Inquietud" },
] as const;

export const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  DESPERFECTO: "Desperfecto",
  CONSULTA_GC: "Consulta de gastos comunes",
  INQUIETUD: "Inquietud",
  VENTA_UNIDAD: "Aviso de venta",
};

export const NOMBRE_ESTADO: Record<EstadoSolicitud, string> = {
  NUEVA: "Nueva",
  EN_CURSO: "En curso",
  RESUELTA: "Resuelta",
};

export function categoriaDeSlug(slug: string) {
  return CATEGORIAS_PUBLICAS.find((c) => c.slug === slug) ?? null;
}

/**
 * Número de WhatsApp en formato internacional, solo dígitos (598…). Acepta lo que
 * se suele escribir en Uruguay: "099 123 456", "+598 99 123 456", "59899123456".
 * Devuelve null si no parece un celular uruguayo.
 */
export function normalizarWhatsapp(texto: string): string | null {
  const d = texto.replace(/[^\d]/g, "");
  if (/^09\d{7}$/.test(d)) return `598${d.slice(1)}`;
  if (/^9\d{7}$/.test(d)) return `598${d}`;
  if (/^5989\d{7}$/.test(d)) return d;
  return null;
}

/** Enlace wa.me con el texto prearmado (categoría + código de unidad + asunto). Sin API de WhatsApp. */
export function enlaceWhatsapp(numero: string, { categoria, codigo, asunto }: { categoria: string; codigo?: string | null; asunto: string }): string {
  const texto = [categoria, codigo ? `Unidad ${codigo}` : null, asunto].filter(Boolean).join(" · ");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

/** Estado que queda al responder: si estaba nueva, pasa a "en curso" (salvo que se marque resuelta). */
export function estadoAlResponder(actual: EstadoSolicitud, marcarResuelta: boolean): EstadoSolicitud {
  if (marcarResuelta) return "RESUELTA";
  return actual === "NUEVA" ? "EN_CURSO" : actual;
}
