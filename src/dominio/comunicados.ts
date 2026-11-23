/** Comunicados de la Administración (C.4): tipos, rutas y validación de los PDF. Lógica pura. */

export type TipoComunicado = "AVISO" | "REGLAMENTO" | "ACTA";

export const TIPOS_COMUNICADO = [
  { slug: "avisos", tipo: "AVISO", nombre: "Avisos importantes", singular: "aviso", mailPorDefecto: true },
  { slug: "reglamentos", tipo: "REGLAMENTO", nombre: "Reglamentos", singular: "reglamento", mailPorDefecto: false },
  { slug: "actas", tipo: "ACTA", nombre: "Actas de asambleas", singular: "acta", mailPorDefecto: false },
] as const;

export function tipoDeSlug(slug: string) {
  return TIPOS_COMUNICADO.find((t) => t.slug === slug) ?? null;
}

/** Hasta 3 MB: entra en el límite de las server actions (y de una función de Vercel). */
export const MAX_PDF = 3 * 1024 * 1024;

/** Devuelve el error del archivo, o null si es un PDF aceptable. */
export function errorDePdf(archivo: { nombre: string; tamano: number; inicio: Uint8Array }): string | null {
  if (archivo.tamano === 0) return "El archivo está vacío.";
  if (archivo.tamano > MAX_PDF) return "El PDF pesa más de 3 MB. Achicalo (por ejemplo, escaneando en menor resolución) y subilo de nuevo.";
  const cabecera = String.fromCharCode(...archivo.inicio.slice(0, 5));
  if (cabecera !== "%PDF-") return "El archivo no es un PDF.";
  return null;
}

/** "Reglamento de copropiedad.pdf" con caracteres seguros para el nombre de descarga. */
export function nombreDescarga(titulo: string): string {
  const limpio = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return `${limpio || "comunicado"}.pdf`;
}

/** Nuevo orden al subir o bajar un elemento: intercambia con el vecino. Devuelve los ids en orden. */
export function mover(ids: string[], id: string, direccion: "arriba" | "abajo"): string[] {
  const i = ids.indexOf(id);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const copia = [...ids];
  [copia[i], copia[j]] = [copia[j], copia[i]];
  return copia;
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
