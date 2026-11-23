import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, exigirUsuario } from "./sesion";
import { avisar } from "./mail";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { puede } from "@/dominio/permisos";
import { estadoPoliza, fraseVencimiento } from "@/dominio/telefonos";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";

const texto = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/[ \t]+/g, " ") ?? "")
    .pipe(z.string().max(max, `Es demasiado largo (máximo ${max} caracteres).`));
const obligatorio = (campo: string, max: number) => texto(max).pipe(z.string().min(1, `Completá ${campo}.`));
const hoyUy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date());
const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);
const deFecha = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Fichas: Administración y Portería
// ---------------------------------------------------------------------------

export const ESQUEMAS_FICHA = {
  ADMINISTRACION: z.object({
    nombre: obligatorio("el nombre", 120),
    mail: texto(120).pipe(z.union([z.literal(""), z.email("Escribí un mail válido.")])),
    direccion: texto(200),
    celulares: texto(200),
    horario: texto(300),
  }),
  PORTERIA: z.object({
    empresa: obligatorio("la empresa", 120),
    telefono: texto(200),
    horario: texto(300),
  }),
};

export type ClaveFicha = keyof typeof ESQUEMAS_FICHA;
export type DatosFicha<C extends ClaveFicha> = z.infer<(typeof ESQUEMAS_FICHA)[C]>;

export async function obtenerFicha<C extends ClaveFicha>(clave: C): Promise<Partial<DatosFicha<C>> | null> {
  await exigirPermiso("telefonos.ver");
  const f = await db.fichaContacto.findUnique({ where: { clave } });
  if (!f) return null;
  const p = ESQUEMAS_FICHA[clave].partial().safeParse(f.datos);
  return p.success ? (p.data as Partial<DatosFicha<C>>) : null;
}

export async function guardarFicha(clave: ClaveFicha, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("telefonos.editar");
  const p = ESQUEMAS_FICHA[clave].safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  await db.$transaction(async (tx) => {
    await tx.fichaContacto.upsert({ where: { clave }, create: { clave, datos: p.data }, update: { datos: p.data } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "telefonos.ficha", entidad: "ficha_contacto", entidadId: clave, detalle: p.data }, tx);
  });
  return ok("Guardaste los datos.");
}

// ---------------------------------------------------------------------------
// Contactos: Comisión, empresas y servicios públicos
// ---------------------------------------------------------------------------

export type TipoContacto = "COMISION" | "EMPRESA" | "SERVICIO";

/**
 * Lista de contactos. De la Comisión, los demás ven solo a quienes dieron su
 * consentimiento (Ley 18.331); Administración ve a todos para poder cargarlo.
 */
export async function listarContactos(tipo: TipoContacto) {
  const usuario = await exigirPermiso("telefonos.ver");
  const todos = puede(usuario, "telefonos.editar");
  return db.contacto.findMany({
    where: { tipo, ...(tipo === "COMISION" && !todos ? { consentimientoEn: { not: null } } : {}) },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: { consentimientoRegistradoPor: { select: { name: true } } },
  });
}

const contactoSchema = z.object({
  nombre: obligatorio("el nombre", 120),
  detalle: texto(160),
  telefono: texto(120),
  unidad: texto(20),
  cuenta: texto(60),
  titular: texto(120),
  consentimiento: z.string().optional().transform((v) => v === "on"),
});

export async function guardarContacto(tipo: TipoContacto, id: string | null, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("telefonos.editar");
  const p = contactoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const { consentimiento, ...datos } = p.data;
  if (tipo !== "SERVICIO" && !datos.telefono) return error("Revisá los datos marcados.", { telefono: "Completá el teléfono." });

  return db.$transaction(async (tx) => {
    const antes = id ? await tx.contacto.findUnique({ where: { id } }) : null;
    if (id && (!antes || antes.tipo !== tipo)) return error("Ese contacto ya no está.");
    // El consentimiento guarda cuándo se registró y quién lo registró; si se quita, deja de mostrarse.
    const conConsentimiento: Prisma.ContactoUncheckedUpdateInput =
      tipo !== "COMISION"
        ? {}
        : consentimiento
          ? antes?.consentimientoEn
            ? {}
            : { consentimientoEn: new Date(), consentimientoRegistradoPorId: actor.userId }
          : { consentimientoEn: null, consentimientoRegistradoPorId: null };
    const c = antes
      ? await tx.contacto.update({ where: { id: antes.id }, data: { ...datos, ...conConsentimiento } })
      : await tx.contacto.create({
          data: { tipo, ...datos, ...(conConsentimiento as Pick<Prisma.ContactoUncheckedCreateInput, "consentimientoEn" | "consentimientoRegistradoPorId">), orden: (await tx.contacto.count({ where: { tipo } })) + 1 },
        });
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: antes ? "telefonos.contacto_modificado" : "telefonos.contacto_alta",
        entidad: "contacto",
        entidadId: c.id,
        detalle: { tipo, nombre: datos.nombre, ...(tipo === "COMISION" ? { consentimiento } : {}) },
      },
      tx,
    );
    return ok(antes ? `Guardaste los datos de ${datos.nombre}.` : `Agregaste a ${datos.nombre}.`);
  });
}

export async function borrarContacto(id: string): Promise<Resultado> {
  const actor = await exigirPermiso("telefonos.editar");
  return db.$transaction(async (tx) => {
    const c = await tx.contacto.findUnique({ where: { id } });
    if (!c) return error("Ese contacto ya no está.");
    await tx.contacto.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "telefonos.contacto_baja", entidad: "contacto", entidadId: id, detalle: { tipo: c.tipo, nombre: c.nombre } }, tx);
    return ok(`Quitaste a ${c.nombre}.`);
  });
}

// ---------------------------------------------------------------------------
// Seguro de incendio
// ---------------------------------------------------------------------------

export async function polizaVigente() {
  await exigirPermiso("telefonos.ver");
  const p = await db.poliza.findFirst({ orderBy: [{ hasta: "desc" }] });
  if (!p) return null;
  const hasta = deFecha(p.hasta);
  return { ...p, desdeTexto: deFecha(p.desde), hastaTexto: hasta, estado: estadoPoliza(hoyUy(), hasta), frase: fraseVencimiento(hoyUy(), hasta) };
}

const polizaSchema = z
  .object({
    aseguradora: obligatorio("la aseguradora", 120),
    numero: obligatorio("el número de póliza", 60),
    cobertura: texto(300),
    telefono: texto(120),
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Completá la fecha."),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Completá la fecha."),
  })
  .refine((d) => d.hasta > d.desde, { path: ["hasta"], message: "Tiene que ser posterior al inicio de la vigencia." });

/** Carga la póliza (o la renueva: una vigencia nueva vuelve a habilitar el aviso de vencimiento). */
export async function guardarPoliza(id: string | null, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("telefonos.editar");
  const p = polizaSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const datos = { ...p.data, desde: aFecha(p.data.desde), hasta: aFecha(p.data.hasta) };
  return db.$transaction(async (tx) => {
    const antes = id ? await tx.poliza.findUnique({ where: { id } }) : null;
    const nuevaVigencia = !antes || deFecha(antes.hasta) !== p.data.hasta;
    const r = antes
      ? await tx.poliza.update({ where: { id: antes.id }, data: { ...datos, ...(nuevaVigencia ? { avisoVencimientoEn: null } : {}) } })
      : await tx.poliza.create({ data: datos });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "telefonos.poliza", entidad: "poliza", entidadId: r.id, detalle: p.data }, tx);
    return ok("Guardaste los datos de la póliza.");
  });
}

/**
 * Si la póliza vence en 30 días o menos y todavía no se avisó, manda un mail a
 * Administración (una vez por vigencia). Sin cron: se llama cuando Administración
 * entra al inicio o al seguro, y desde /api/cron/seguro si se programa en el hosting.
 */
export async function revisarVencimientoSeguro(): Promise<boolean> {
  const p = await db.poliza.findFirst({ orderBy: [{ hasta: "desc" }] });
  if (!p || p.avisoVencimientoEn) return false;
  const hoy = hoyUy();
  const hasta = deFecha(p.hasta);
  if (estadoPoliza(hoy, hasta) === "VIGENTE") return false;
  // Marca primero (dentro de una condición) para no mandar dos veces si hay pedidos simultáneos.
  const marcado = await db.poliza.updateMany({ where: { id: p.id, avisoVencimientoEn: null }, data: { avisoVencimientoEn: new Date() } });
  if (marcado.count === 0) return false;
  const admins = await db.user.findMany({ where: { rol: "ADMINISTRACION", activo: true }, select: { email: true } });
  const [a, m, d] = hasta.split("-");
  for (const admin of admins) {
    await avisar({
      para: admin.email,
      asunto: `El seguro de incendio ${fraseVencimiento(hoy, hasta)}`,
      texto: [
        `La póliza ${p.numero} de ${p.aseguradora} ${fraseVencimiento(hoy, hasta)} (${d}/${m}/${a}).`,
        "Cuando la renueves, cargá la nueva vigencia en Teléfonos y datos de interés → Seguro de incendio.",
        "",
        NOMBRE_COMPLEJO,
      ].join("\n"),
    });
  }
  return true;
}

/** Para el inicio de Administración: la póliza si hay que mirarla. */
export async function alertaSeguro() {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "telefonos.editar")) return null;
  await revisarVencimientoSeguro();
  const p = await polizaVigente();
  return p && p.estado !== "VIGENTE" ? p : null;
}
