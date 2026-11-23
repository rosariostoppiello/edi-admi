import "server-only";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso } from "./sesion";
import { enviarMail } from "./mail";
import { destinatariosPorUnidad } from "./datos";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { textoSchema } from "@/dominio/liquidacion/esquemas";
import { MAX_PDF, errorDePdf, mover, nombreDescarga, tipoDeSlug, type TipoComunicado } from "@/dominio/comunicados";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";

const LOTE = 10;
const ASUNTO: Record<TipoComunicado, string> = { AVISO: "Aviso importante", REGLAMENTO: "Reglamento", ACTA: "Acta de asamblea" };
const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function listarComunicados(tipo: TipoComunicado) {
  await exigirPermiso("comunicado.ver");
  return db.comunicado.findMany({
    where: { tipo, activo: true },
    include: { archivo: { select: { tamano: true } } },
    // Avisos y actas: lo último arriba. Reglamentos: el orden que elige Administración.
    orderBy: tipo === "REGLAMENTO" ? [{ orden: "asc" }, { titulo: "asc" }] : [{ fecha: "desc" }, { createdAt: "desc" }],
  });
}

/** PDF de un comunicado vigente. Lo pueden bajar todos los usuarios con sesión. */
export async function obtenerPdfComunicado(id: string) {
  await exigirPermiso("comunicado.ver");
  const c = await db.comunicado.findUnique({ where: { id }, include: { archivo: true } });
  if (!c || !c.activo || !c.archivo) return null;
  return { nombre: nombreDescarga(c.titulo), datos: c.archivo.datos };
}

/** Para enlazarlo desde Barbacoas. */
export async function reglamentoDeBarbacoas() {
  await exigirPermiso("comunicado.ver");
  return db.comunicado.findFirst({
    where: { tipo: "REGLAMENTO", activo: true, titulo: { contains: "barbacoa", mode: "insensitive" } },
    select: { id: true, titulo: true, archivoId: true },
  });
}

export async function envioDe(comunicadoId: string) {
  await exigirPermiso("comunicado.publicar");
  const grupos = await db.envioMail.groupBy({ by: ["estado"], where: { tipo: "comunicado", refId: comunicadoId }, _count: true });
  return Object.fromEntries(grupos.map((g) => [g.estado, g._count])) as Partial<Record<"PENDIENTE" | "ENVIADO" | "ERROR", number>>;
}

// ---------------------------------------------------------------------------
// Publicar, editar, dar de baja, ordenar (Administración)
// ---------------------------------------------------------------------------

const fechaSchema = z
  .string({ error: "Completá la fecha." })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Completá la fecha.")
  .refine((f) => !Number.isNaN(aFecha(f).getTime()) && aFecha(f).toISOString().startsWith(f), "Esa fecha no existe.");

const comunicadoSchema = z.object({
  titulo: textoSchema("el título", 160),
  fecha: fechaSchema,
  cuerpo: z
    .string()
    .optional()
    .transform((s) => s?.trim() ?? "")
    .pipe(z.string().max(10000, "Es demasiado largo (máximo 10.000 caracteres).")),
  enviar: z.string().optional().transform((v) => v === "on"),
});

/** Lee el PDF del formulario (opcional). Devuelve los bytes, null si no vino, o un error. */
async function leerPdf(archivo: unknown): Promise<{ datos: Uint8Array<ArrayBuffer>; tamano: number } | null | { error: string }> {
  if (!(archivo instanceof File) || archivo.size === 0) return null;
  if (archivo.size > MAX_PDF) return { error: errorDePdf({ nombre: archivo.name, tamano: archivo.size, inicio: new Uint8Array() })! };
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const e = errorDePdf({ nombre: archivo.name, tamano: datos.length, inicio: datos.slice(0, 5) });
  return e ? { error: e } : { datos, tamano: datos.length };
}

export async function publicarComunicado(slug: string, input: Record<string, unknown>): Promise<Resultado> {
  const actor = await exigirPermiso("comunicado.publicar");
  const t = tipoDeSlug(slug);
  if (!t) return error("Ese tipo de comunicado no existe.");
  const p = comunicadoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const pdf = await leerPdf(input.archivo);
  if (pdf && "error" in pdf) return error("Revisá los datos marcados.", { archivo: pdf.error });
  if (t.tipo === "REGLAMENTO" && !pdf) return error("Revisá los datos marcados.", { archivo: "Subí el PDF del reglamento." });
  if (!pdf && !p.data.cuerpo) return error("Revisá los datos marcados.", { cuerpo: "Escribí el texto o subí un PDF." });
  const enviar = t.tipo !== "REGLAMENTO" && p.data.enviar;

  const r = await db.$transaction(async (tx) => {
    const archivo = pdf
      ? await tx.archivo.create({ data: { nombre: nombreDescarga(p.data.titulo), tipo: "application/pdf", tamano: pdf.tamano, datos: pdf.datos } })
      : null;
    const orden = t.tipo === "REGLAMENTO" ? (await tx.comunicado.count({ where: { tipo: "REGLAMENTO", activo: true } })) + 1 : 0;
    const c = await tx.comunicado.create({
      data: {
        tipo: t.tipo,
        titulo: p.data.titulo,
        fecha: aFecha(p.data.fecha),
        cuerpo: p.data.cuerpo,
        archivoId: archivo?.id,
        publicadoPorId: actor.userId,
        enviadoPorMail: enviar,
        orden,
      },
    });
    let mails = 0;
    if (enviar) {
      // Los mismos destinatarios que la liquidación: responsables, inquilinos y mails extra.
      const emails = [...new Set((await destinatariosPorUnidad()).flatMap((u) => u.destinatarios.map((d) => d.email.toLowerCase())))];
      await tx.envioMail.createMany({ data: emails.map((e) => ({ tipo: "comunicado", refId: c.id, destinatario: e, asunto: `${ASUNTO[t.tipo]}: ${p.data.titulo}` })) });
      mails = emails.length;
    }
    await registrarAuditoria(
      { usuarioId: actor.userId, accion: "comunicado.publicado", entidad: "comunicado", entidadId: c.id, detalle: { tipo: t.tipo, titulo: p.data.titulo, mails } },
      tx,
    );
    return { id: c.id, mails };
  });

  if (r.mails) {
    const e = await procesarEnvios(r.id);
    return ok(`Publicaste el ${t.singular} y lo mandaste por mail a ${e.enviados} ${e.enviados === 1 ? "destinatario" : "destinatarios"}${e.errores ? ` (${e.errores} con error)` : ""}.`);
  }
  return ok(`Publicaste el ${t.singular}.`);
}

/** Manda los mails pendientes de un comunicado, de a 10. El PDF va adjunto. */
async function procesarEnvios(comunicadoId: string) {
  const c = await db.comunicado.findUnique({ where: { id: comunicadoId }, include: { archivo: true } });
  if (!c) return { enviados: 0, errores: 0 };
  const pendientes = await db.envioMail.findMany({ where: { tipo: "comunicado", refId: comunicadoId, estado: { in: ["PENDIENTE", "ERROR"] } } });
  const base = process.env.BETTER_AUTH_URL ?? "";
  const slug = { AVISO: "avisos", REGLAMENTO: "reglamentos", ACTA: "actas" }[c.tipo];
  const texto = [c.titulo, "", c.cuerpo, "", c.archivo ? "Va adjunto el documento." : "", `También lo podés ver en el sistema: ${base}/comunicados/${slug}`, "", NOMBRE_COMPLEJO]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  const adjuntos = c.archivo ? [{ nombre: c.archivo.nombre, tipo: c.archivo.tipo, contenido: Buffer.from(c.archivo.datos) }] : undefined;
  let enviados = 0;
  let errores = 0;
  for (let i = 0; i < pendientes.length; i += LOTE) {
    await Promise.all(
      pendientes.slice(i, i + LOTE).map(async (envio) => {
        try {
          await enviarMail({ para: envio.destinatario, asunto: envio.asunto, texto, adjuntos });
          await db.envioMail.update({ where: { id: envio.id }, data: { estado: "ENVIADO", enviadoEn: new Date(), error: null, intentos: { increment: 1 } } });
          enviados++;
        } catch (e) {
          await db.envioMail.update({ where: { id: envio.id }, data: { estado: "ERROR", error: String((e as Error).message).slice(0, 300), intentos: { increment: 1 } } });
          errores++;
        }
      }),
    );
  }
  return { enviados, errores };
}

export async function reintentarEnvios(comunicadoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("comunicado.publicar");
  const r = await procesarEnvios(comunicadoId);
  await registrarAuditoria({ usuarioId: actor.userId, accion: "comunicado.reenvio", entidad: "comunicado", entidadId: comunicadoId, detalle: r });
  if (r.enviados + r.errores === 0) return ok("No había mails pendientes.");
  return r.errores ? error(`Se mandaron ${r.enviados}; ${r.errores} siguen con error.`) : ok(`Se mandaron ${r.enviados} mails.`);
}

export async function editarComunicado(id: string, input: Record<string, unknown>): Promise<Resultado> {
  const actor = await exigirPermiso("comunicado.publicar");
  const p = comunicadoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const pdf = await leerPdf(input.archivo);
  if (pdf && "error" in pdf) return error("Revisá los datos marcados.", { archivo: pdf.error });

  return db.$transaction(async (tx) => {
    const antes = await tx.comunicado.findUnique({ where: { id } });
    if (!antes || !antes.activo) return error("Ese comunicado ya no está.");
    if (!pdf && !antes.archivoId && !p.data.cuerpo) return error("Revisá los datos marcados.", { cuerpo: "Escribí el texto o subí un PDF." });
    let archivoId = antes.archivoId;
    if (pdf) {
      const nuevo = await tx.archivo.create({ data: { nombre: nombreDescarga(p.data.titulo), tipo: "application/pdf", tamano: pdf.tamano, datos: pdf.datos } });
      archivoId = nuevo.id;
    }
    await tx.comunicado.update({ where: { id }, data: { titulo: p.data.titulo, fecha: aFecha(p.data.fecha), cuerpo: p.data.cuerpo, archivoId } });
    if (pdf && antes.archivoId) await tx.archivo.delete({ where: { id: antes.archivoId } });
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: "comunicado.editado",
        entidad: "comunicado",
        entidadId: id,
        detalle: { antes: { titulo: antes.titulo, fecha: antes.fecha.toISOString().slice(0, 10) }, despues: { titulo: p.data.titulo, fecha: p.data.fecha }, pdfNuevo: Boolean(pdf) },
      },
      tx,
    );
    return ok("Guardaste los cambios.");
  });
}

export async function darDeBaja(id: string): Promise<Resultado> {
  const actor = await exigirPermiso("comunicado.publicar");
  return db.$transaction(async (tx) => {
    const c = await tx.comunicado.findUnique({ where: { id } });
    if (!c || !c.activo) return error("Ese comunicado ya no está.");
    await tx.comunicado.update({ where: { id }, data: { activo: false } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "comunicado.baja", entidad: "comunicado", entidadId: id, detalle: { tipo: c.tipo, titulo: c.titulo } }, tx);
    return ok(`Diste de baja "${c.titulo}".`);
  });
}

export async function moverReglamento(id: string, direccion: "arriba" | "abajo"): Promise<Resultado> {
  await exigirPermiso("comunicado.publicar");
  return db.$transaction(async (tx) => {
    const lista = await tx.comunicado.findMany({ where: { tipo: "REGLAMENTO", activo: true }, orderBy: [{ orden: "asc" }, { titulo: "asc" }], select: { id: true } });
    const nuevo = mover(lista.map((r) => r.id), id, direccion);
    for (const [i, rid] of nuevo.entries()) await tx.comunicado.update({ where: { id: rid }, data: { orden: i + 1 } });
    return ok("Cambiaste el orden.");
  });
}
