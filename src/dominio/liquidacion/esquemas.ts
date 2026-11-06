/** Esquemas Zod de entrada de la confección (montos y fechas como texto, nunca floats). */
import { z } from "zod";
import { parsearMonto } from "../dinero";
import { parsearFecha } from "./periodo";

export const montoSchema = (opciones: { positivo?: boolean; campo?: string } = {}) =>
  z
    .string({ error: `Completá ${opciones.campo ?? "el monto"}.` })
    .trim()
    .min(1, `Completá ${opciones.campo ?? "el monto"}.`)
    .transform((t, ctx) => {
      try {
        const m = parsearMonto(t);
        if (opciones.positivo && m <= 0) {
          ctx.addIssue({ code: "custom", message: "Tiene que ser mayor que cero." });
          return z.NEVER;
        }
        return m as number;
      } catch {
        ctx.addIssue({ code: "custom", message: "Escribilo como 1.234,50 (punto de miles, coma decimal)." });
        return z.NEVER;
      }
    });

export const fechaSchema = z
  .string({ error: "Completá la fecha." })
  .trim()
  .min(1, "Completá la fecha.")
  .transform((t, ctx) => {
    const f = parsearFecha(t);
    if (!f) {
      ctx.addIssue({ code: "custom", message: "Escribí la fecha como dd/mm/aaaa." });
      return z.NEVER;
    }
    return f;
  });

export const textoSchema = (campo: string, max: number) =>
  z
    .string({ error: `Completá ${campo}.` })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, `Completá ${campo}.`).max(max, `Es demasiado largo (máximo ${max} caracteres).`));

export const textoOpcional = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/\s+/g, " ") || null)
    .pipe(z.string().max(max).nullable());
