import { z } from "zod";
import type { Calidad } from "./permisos";
import type { Sufijo } from "./codigos";

/**
 * Validación de los datos de contacto de un responsable. Se usa en el servidor
 * (server actions) y en los tests. Ningún campo puede quedar vacío.
 */

const texto = (campo: string, max: number) =>
  z
    .string({ error: `Completá ${campo}.` })
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, `Completá ${campo}.`).max(max, `${campo} es demasiado largo.`));

export const telefonoSchema = z
  .string({ error: "Completá el teléfono." })
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "Completá el teléfono.")
      .refine((s) => /^\+?[\d\s\-()]+$/.test(s), "El teléfono solo puede tener números, espacios y guiones.")
      .refine((s) => {
        const digitos = s.replace(/\D/g, "").length;
        return digitos >= 8 && digitos <= 15;
      }, "El teléfono tiene que tener entre 8 y 15 números (ej. 099 123 456)."),
  );

export const emailSchema = z
  .string({ error: "Completá el mail." })
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().min(1, "Completá el mail.").email("Ese mail no parece válido (ej. nombre@gmail.com).").max(200));

export const datosPersonaSchema = z.object({
  nombre: texto("el nombre", 120).pipe(z.string().min(2, "El nombre es demasiado corto.")),
  telefono: telefonoSchema,
  email: emailSchema,
});

export type DatosPersona = z.infer<typeof datosPersonaSchema>;

/** Calidades posibles para el responsable principal (no inquilino). */
export const calidadDuenoSchema = z.enum(["PROPIETARIO", "PROMITENTE"], {
  error: "Elegí si sos propietario o promitente comprador.",
});

export const NOMBRE_CALIDAD: Record<Calidad, string> = {
  PROPIETARIO: "Propietario",
  PROMITENTE: "Promitente comprador",
  INQUILINO: "Inquilino",
};

export const esDueno = (c: Calidad) => c === "PROPIETARIO" || c === "PROMITENTE";

/** Estado mínimo de una unidad para decidir transiciones. */
export interface EstadoUnidad {
  arrendada: boolean;
  personasActivas: { id: string; calidad: Calidad; email: string }[];
}

export type ErrorTransicion =
  | "SIN_DUENO"
  | "YA_ARRENDADA"
  | "NO_ARRENDADA"
  | "INQUILINO_NO_ENCONTRADO"
  | "MAIL_DEL_DUENO";

export const MENSAJE_TRANSICION: Record<ErrorTransicion, string> = {
  SIN_DUENO: "La unidad no tiene propietario cargado. Avisale a la administración.",
  YA_ARRENDADA: "La unidad ya tiene un inquilino. Dalo de baja antes de cargar otro.",
  NO_ARRENDADA: "La unidad no tiene inquilino.",
  INQUILINO_NO_ENCONTRADO: "No encontramos a ese inquilino en la unidad.",
  MAIL_DEL_DUENO: "El mail del inquilino tiene que ser distinto al del propietario.",
};

/**
 * Alta de inquilino: la unidad pasa de A a P+I.
 * Devuelve el error o null si se puede.
 */
export function validarAltaInquilino(u: EstadoUnidad, emailInquilino: string): ErrorTransicion | null {
  const duenos = u.personasActivas.filter((p) => esDueno(p.calidad));
  if (duenos.length === 0) return "SIN_DUENO";
  if (u.arrendada || u.personasActivas.some((p) => p.calidad === "INQUILINO")) return "YA_ARRENDADA";
  if (duenos.some((d) => d.email === emailInquilino.trim().toLowerCase())) return "MAIL_DEL_DUENO";
  return null;
}

/** Baja de inquilino: la unidad vuelve de P+I a A. */
export function validarBajaInquilino(u: EstadoUnidad, personaId: string): ErrorTransicion | null {
  if (!u.arrendada) return "NO_ARRENDADA";
  const p = u.personasActivas.find((x) => x.id === personaId);
  if (!p || p.calidad !== "INQUILINO") return "INQUILINO_NO_ENCONTRADO";
  return null;
}

export interface Destinatario {
  email: string;
  nombre: string | null;
  /** Línea de la liquidación que le corresponde (A, P o I). */
  sufijo: Sufijo;
}

/**
 * A quién se le manda la liquidación y los comunicados de una unidad:
 * el responsable (A, o P si está alquilada), el inquilino (I) y los mails
 * extra, que van con el responsable. Sin mails repetidos.
 */
export function destinatariosDeUnidad(u: {
  arrendada: boolean;
  personasActivas: { calidad: Calidad; email: string; nombre: string }[];
  extras: { email: string; nombre: string | null }[];
}): Destinatario[] {
  const sufijoDueno: Sufijo = u.arrendada ? "P" : "A";
  const lista: Destinatario[] = [];
  const vistos = new Set<string>();
  const agregar = (email: string, nombre: string | null, sufijo: Sufijo) => {
    const e = email.trim().toLowerCase();
    if (!e || vistos.has(e)) return;
    vistos.add(e);
    lista.push({ email: e, nombre, sufijo });
  };
  for (const p of u.personasActivas) if (esDueno(p.calidad)) agregar(p.email, p.nombre, sufijoDueno);
  if (u.arrendada) for (const p of u.personasActivas) if (p.calidad === "INQUILINO") agregar(p.email, p.nombre, "I");
  for (const x of u.extras) agregar(x.email, x.nombre, sufijoDueno);
  return lista;
}
