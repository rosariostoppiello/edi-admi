import type { z } from "zod";

/** Resultado de una acción de servidor, para mostrar en el formulario. */
export type Resultado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; campos?: Partial<Record<string, string>> };

export function erroresDeZod(error: z.ZodError): Resultado {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "general");
    campos[k] ??= issue.message;
  }
  return { ok: false, error: "Revisá los datos marcados.", campos };
}

export const error = (mensaje: string, campos?: Partial<Record<string, string>>): Resultado => ({ ok: false, error: mensaje, campos });
export const ok = (mensaje: string): Resultado => ({ ok: true, mensaje });
