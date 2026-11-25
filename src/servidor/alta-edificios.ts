import "server-only";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, exigirUsuario } from "./sesion";
import { avisar } from "./mail";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { leerTorres, modulosAGuardar } from "@/dominio/edificios";

/**
 * Alta de edificios (decisión 86): un administrador la pide, el dueño del sistema la
 * aprueba o la rechaza. Cada edificio es independiente (datos, liquidación, cobranza).
 */

const urlBase = () => process.env.BETTER_AUTH_URL ?? "";
const texto = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/[ \t]+/g, " ") ?? "")
    .pipe(z.string().max(max, `Es demasiado largo (máximo ${max} caracteres).`));

const altaSchema = z.object({
  nombre: texto(80).pipe(z.string().min(2, "Escribí el nombre del edificio.")),
  direccion: texto(160),
  torres: z.string().optional().transform((s) => s ?? ""),
});

export async function solicitarEdificio(input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("edificio.solicitarAlta");
  const p = altaSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const t = leerTorres(p.data.torres);
  if ("error" in t) return error("Revisá los datos marcados.", { torres: t.error });

  const e = await db.$transaction(async (tx) => {
    const edificio = await tx.edificio.create({
      data: { nombre: p.data.nombre, direccion: p.data.direccion, estado: "PENDIENTE", solicitadoPorId: actor.userId },
    });
    for (const [i, torre] of t.torres.entries()) {
      await tx.torre.create({ data: { edificioId: edificio.id, numero: torre.numero, nombre: torre.nombre, orden: i + 1 } });
    }
    await tx.configuracion.create({ data: { edificioId: edificio.id, direccion: p.data.direccion } });
    await registrarAuditoria(
      { usuarioId: actor.userId, accion: "edificio.solicitado", entidad: "edificio", entidadId: edificio.id, detalle: { nombre: p.data.nombre, torres: t.torres.length } },
      tx,
    );
    return edificio;
  });

  const duenos = await db.user.findMany({ where: { duenoSistema: true, activo: true }, select: { email: true } });
  for (const d of duenos) {
    await avisar({
      para: d.email,
      asunto: `Pedido de alta de edificio: ${p.data.nombre}`,
      texto: [`${actor.nombre} pide dar de alta "${p.data.nombre}"${p.data.direccion ? ` (${p.data.direccion})` : ""}.`, "", `Para revisarlo: ${urlBase()}/sistema`].join("\n"),
    });
  }
  return ok(`Pediste el alta de ${e.nombre}. Cuando el dueño del sistema lo apruebe, te llega un mail y aparece en tus edificios.`);
}

// ---------------------------------------------------------------------------
// Dueño del sistema
// ---------------------------------------------------------------------------

async function exigirDueno() {
  const usuario = await exigirUsuario();
  return usuario.duenoSistema ? usuario : null;
}

export async function listarEdificiosDelSistema() {
  if (!(await exigirDueno())) return null;
  return db.edificio.findMany({
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    include: {
      solicitadoPor: { select: { name: true, email: true } },
      revisadoPor: { select: { name: true } },
      _count: { select: { torres: true, unidades: true } },
    },
  });
}

export async function aprobarEdificio(id: string): Promise<Resultado> {
  const dueno = await exigirDueno();
  if (!dueno) return error("Solo el dueño del sistema puede aprobar edificios.");
  const r = await db.$transaction(async (tx) => {
    const e = await tx.edificio.findUnique({ where: { id }, include: { solicitadoPor: { select: { email: true } } } });
    if (!e || e.estado !== "PENDIENTE") return null;
    await tx.edificio.update({ where: { id }, data: { estado: "ACTIVO", revisadoPorId: dueno.userId, revisadoEn: new Date() } });
    // Quien lo pidió queda como Administración del edificio nuevo.
    if (e.solicitadoPorId) {
      await tx.membresia.upsert({
        where: { userId_edificioId: { userId: e.solicitadoPorId, edificioId: id } },
        create: { userId: e.solicitadoPorId, edificioId: id, rol: "ADMINISTRACION" },
        update: { rol: "ADMINISTRACION" },
      });
    }
    await registrarAuditoria({ usuarioId: dueno.userId, accion: "edificio.aprobado", entidad: "edificio", entidadId: id, detalle: { nombre: e.nombre } }, tx);
    return e;
  });
  if (!r) return error("Ese edificio ya se revisó.");
  if (r.solicitadoPor) {
    await avisar({
      para: r.solicitadoPor.email,
      asunto: `Ya está el edificio ${r.nombre}`,
      texto: [`Aprobamos el alta de "${r.nombre}". Ya aparece en tus edificios.`, "", `Para empezar a cargar las unidades: ${urlBase()}/edificios`].join("\n"),
    });
  }
  return ok(`Aprobaste ${r.nombre}.`);
}

const rechazoSchema = z.object({ motivo: texto(500) });

export async function rechazarEdificio(id: string, input: unknown): Promise<Resultado> {
  const dueno = await exigirDueno();
  if (!dueno) return error("Solo el dueño del sistema puede rechazar edificios.");
  const p = rechazoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const r = await db.$transaction(async (tx) => {
    const e = await tx.edificio.findUnique({ where: { id }, include: { solicitadoPor: { select: { email: true } } } });
    if (!e || e.estado !== "PENDIENTE") return null;
    await tx.edificio.update({ where: { id }, data: { estado: "RECHAZADO", revisadoPorId: dueno.userId, revisadoEn: new Date(), motivoRechazo: p.data.motivo || null } });
    await registrarAuditoria({ usuarioId: dueno.userId, accion: "edificio.rechazado", entidad: "edificio", entidadId: id, detalle: { motivo: p.data.motivo } }, tx);
    return e;
  });
  if (!r) return error("Ese edificio ya se revisó.");
  if (r.solicitadoPor) {
    await avisar({
      para: r.solicitadoPor.email,
      asunto: `Tu pedido de alta de ${r.nombre}`,
      texto: [`No aprobamos el alta de "${r.nombre}".`, p.data.motivo ? `Motivo: ${p.data.motivo}` : ""].filter(Boolean).join("\n"),
    });
  }
  return ok(`Rechazaste ${r.nombre}.`);
}

// ---------------------------------------------------------------------------
// Módulos del edificio (decisión 87)
// ---------------------------------------------------------------------------

export async function guardarModulos(elegidos: string[]): Promise<Resultado> {
  const actor = await exigirPermiso("edificio.configurarModulos");
  const modulos = modulosAGuardar(elegidos);
  await db.$transaction(async (tx) => {
    await tx.edificio.update({ where: { id: actor.edificio.id }, data: { modulos } });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "edificio.modulos", entidad: "edificio", entidadId: actor.edificio.id, detalle: { modulos } },
      tx,
    );
  });
  return ok("Guardaste los módulos del edificio.");
}
