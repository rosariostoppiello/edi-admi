import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, exigirUsuario, type UsuarioActual } from "./sesion";
import { unidadActiva } from "./unidad-activa";
import { enviarMail } from "./mail";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { puede } from "@/dominio/permisos";
import { codigoBase } from "@/dominio/codigos";
import { textoOpcional, textoSchema } from "@/dominio/liquidacion/esquemas";
import {
  NOMBRE_CATEGORIA,
  NOMBRE_ESTADO,
  categoriaDeSlug,
  estadoAlResponder,
  normalizarWhatsapp,
  type Categoria,
  type EstadoSolicitud,
} from "@/dominio/solicitudes";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";

const urlBase = () => process.env.BETTER_AUTH_URL ?? "";

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

const solicitudSchema = z.object({
  asunto: textoSchema("el asunto", 120),
  texto: z
    .string({ error: "Contá qué pasa." })
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Contá qué pasa.").max(4000, "Es demasiado largo (máximo 4000 caracteres).")),
  origen: z.enum(["PROPIA", "A_PEDIDO"]).optional(),
  codigo: textoOpcional(20),
  pedidaPor: textoOpcional(80),
});

/** "2-201", "2-201-A" o "2 201" → unidad activa. */
async function unidadPorCodigo(texto: string) {
  const m = /^(\d{1,3})[\s-]+([0-9A-Za-z]{1,6})(?:[\s-]*[APIapi])?$/.exec(texto.trim());
  if (!m) return null;
  return db.unidad.findFirst({ where: { torreId: Number(m[1]), numero: m[2].toUpperCase(), activa: true }, select: { id: true, torreId: true, numero: true } });
}

export async function crearSolicitud(slug: string, input: unknown): Promise<Resultado & { id?: string; codigo?: string | null }> {
  const usuario = await exigirUsuario();
  const cat = categoriaDeSlug(slug);
  if (!cat) return error("Esa categoría no existe.");
  const p = solicitudSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;

  let unidadId: string | null = null;
  let codigo: string | null = null;
  let origen: "UNIDAD" | "PORTERIA_PROPIA" | "PORTERIA_A_PEDIDO" = "UNIDAD";
  let pedidaPor: string | null = null;

  if (usuario.rol === "PORTERIA") {
    if (d.origen === "A_PEDIDO") {
      const campos: Record<string, string> = {};
      const u = d.codigo ? await unidadPorCodigo(d.codigo) : null;
      if (!d.codigo) campos.codigo = "Escribí el código de la unidad (ej. 2-201).";
      else if (!u) campos.codigo = `No encontramos la unidad ${d.codigo}.`;
      if (!d.pedidaPor) campos.pedidaPor = "Anotá quién te lo pidió.";
      if (Object.keys(campos).length) return error("Revisá los datos marcados.", campos);
      await exigirPermiso("solicitud.crear", { unidadId: u!.id });
      unidadId = u!.id;
      codigo = codigoBase(u!.torreId, u!.numero);
      origen = "PORTERIA_A_PEDIDO";
      pedidaPor = d.pedidaPor;
    } else if (d.origen === "PROPIA") {
      await exigirPermiso("solicitud.crearPorteria");
      origen = "PORTERIA_PROPIA";
    } else {
      return error("Revisá los datos marcados.", { origen: "Elegí si es por vos o a pedido de una unidad." });
    }
  } else {
    const u = await unidadActiva(usuario);
    if (!u) return error("Tu usuario no está vinculado a ninguna unidad.");
    await exigirPermiso("solicitud.crear", { unidadId: u.unidadId });
    unidadId = u.unidadId;
    codigo = codigoBase(u.torre, u.numero);
  }

  const s = await db.solicitud.create({
    data: { unidadId, autorId: usuario.userId, categoria: cat.categoria, origen, pedidaPor, asunto: d.asunto, texto: d.texto },
  });

  // Mail a Administración (fuera de la transacción: si falla, la solicitud igual queda).
  const admins = await db.user.findMany({ where: { rol: "ADMINISTRACION", activo: true }, select: { email: true } });
  const quien =
    origen === "PORTERIA_A_PEDIDO" ? `Portería, a pedido de ${pedidaPor} (unidad ${codigo})` : origen === "PORTERIA_PROPIA" ? "Portería" : `${usuario.nombre} (unidad ${codigo})`;
  for (const a of admins) {
    await enviarMail({
      para: a.email,
      asunto: `${cat.corto}: ${d.asunto}`,
      texto: [`${quien} hizo una solicitud.`, "", d.asunto, d.texto, "", `Para responderla: ${urlBase()}/solicitudes/ver/${s.id}`, "", NOMBRE_COMPLEJO].join("\n"),
    });
  }
  return { ...ok("Enviaste la solicitud. Te avisamos por mail cuando la Administración responda."), id: s.id, codigo };
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

const seleccion = {
  id: true,
  categoria: true,
  origen: true,
  pedidaPor: true,
  asunto: true,
  estado: true,
  creadaEn: true,
  unidadId: true,
  unidad: { select: { torreId: true, numero: true } },
  autor: { select: { name: true } },
  _count: { select: { eventos: { where: { tipo: "RESPUESTA" } } } },
} satisfies Prisma.SolicitudSelect;

function resumir(s: Prisma.SolicitudGetPayload<{ select: typeof seleccion }>) {
  return {
    id: s.id,
    categoria: s.categoria as Categoria,
    origen: s.origen,
    pedidaPor: s.pedidaPor,
    asunto: s.asunto,
    estado: s.estado as EstadoSolicitud,
    creadaEn: s.creadaEn,
    codigo: s.unidad ? codigoBase(s.unidad.torreId, s.unidad.numero) : null,
    autor: s.autor.name,
    respuestas: s._count.eventos,
  };
}

export type SolicitudResumida = ReturnType<typeof resumir>;

/**
 * "Mis solicitudes": las que hizo el usuario y las que Portería cargó a pedido de
 * sus unidades. Una unidad nunca ve las de otra.
 */
function condicionPropias(usuario: UsuarioActual): Prisma.SolicitudWhereInput {
  const mias = usuario.unidades.map((u) => u.unidadId);
  return { OR: [{ autorId: usuario.userId }, { unidadId: { in: mias }, origen: "PORTERIA_A_PEDIDO" }] };
}

export async function misSolicitudes(categoria?: Categoria) {
  const usuario = await exigirUsuario();
  const filas = await db.solicitud.findMany({
    where: { ...condicionPropias(usuario), ...(categoria ? { categoria } : { categoria: { not: "VENTA_UNIDAD" } }) },
    select: seleccion,
    orderBy: { creadaEn: "desc" },
    take: 50,
  });
  return filas.map(resumir);
}

export async function bandeja(filtro: { categoria?: Categoria; estado?: EstadoSolicitud }) {
  await exigirPermiso("solicitud.verTodas");
  const filas = await db.solicitud.findMany({
    where: { ...(filtro.categoria ? { categoria: filtro.categoria } : {}), ...(filtro.estado ? { estado: filtro.estado } : {}) },
    select: seleccion,
    orderBy: [{ creadaEn: "desc" }],
    take: 200,
  });
  return filas.map(resumir);
}

export async function contarNuevas() {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "solicitud.verTodas")) return 0;
  return db.solicitud.count({ where: { estado: "NUEVA" } });
}

/** Detalle con su historial. Las notas internas solo las ve Administración. */
export async function obtenerSolicitud(id: string) {
  const usuario = await exigirUsuario();
  const s = await db.solicitud.findUnique({
    where: { id },
    include: {
      unidad: { select: { torreId: true, numero: true } },
      autor: { select: { name: true } },
      eventos: { orderBy: { fecha: "asc" }, include: { autor: { select: { name: true } } } },
    },
  });
  if (!s) return null;
  const gestiona = puede(usuario, "solicitud.gestionar");
  const propia = s.autorId === usuario.userId || (s.origen === "PORTERIA_A_PEDIDO" && usuario.unidades.some((u) => u.unidadId === s.unidadId));
  if (!propia && !puede(usuario, "solicitud.verTodas")) return null;
  return {
    ...s,
    codigo: s.unidad ? codigoBase(s.unidad.torreId, s.unidad.numero) : null,
    eventos: s.eventos.filter((e) => gestiona || e.tipo !== "NOTA_INTERNA"),
    gestiona,
  };
}

// ---------------------------------------------------------------------------
// Gestión (Administración)
// ---------------------------------------------------------------------------

const respuestaSchema = z.object({
  texto: z
    .string({ error: "Escribí la respuesta." })
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Escribí la respuesta.").max(4000, "Es demasiado largo (máximo 4000 caracteres).")),
  resuelta: z.string().optional().transform((v) => v === "on"),
});

export async function responder(id: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("solicitud.gestionar");
  const p = respuestaSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);

  const r = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "solicitud" WHERE id = ${id} FOR UPDATE`;
    const s = await tx.solicitud.findUnique({ where: { id }, include: { autor: { select: { email: true, name: true, activo: true } } } });
    if (!s) return null;
    await tx.solicitudEvento.create({ data: { solicitudId: id, autorId: actor.userId, tipo: "RESPUESTA", texto: p.data.texto } });
    const nuevo = estadoAlResponder(s.estado, p.data.resuelta);
    if (nuevo !== s.estado) await cambiar(tx, actor, id, s.estado, nuevo);
    return s;
  });
  if (!r) return error("No encontramos esa solicitud.");

  if (r.autor.activo) {
    await enviarMail({
      para: r.autor.email,
      asunto: `Respuesta a tu solicitud: ${r.asunto}`,
      texto: [`Hola ${r.autor.name}:`, "", "La Administración respondió tu solicitud:", "", p.data.texto, "", `Podés verla acá: ${urlBase()}/solicitudes/ver/${id}`, "", NOMBRE_COMPLEJO].join("\n"),
    });
  }
  return ok("Respondiste la solicitud. Le avisamos por mail.");
}

async function cambiar(tx: Prisma.TransactionClient, actor: UsuarioActual, id: string, antes: EstadoSolicitud, despues: EstadoSolicitud) {
  await tx.solicitud.update({ where: { id }, data: { estado: despues, resueltaEn: despues === "RESUELTA" ? new Date() : null } });
  await tx.solicitudEvento.create({
    data: { solicitudId: id, autorId: actor.userId, tipo: "CAMBIO_ESTADO", texto: `Pasó de ${NOMBRE_ESTADO[antes].toLowerCase()} a ${NOMBRE_ESTADO[despues].toLowerCase()}.` },
  });
  await registrarAuditoria({ usuarioId: actor.userId, accion: "solicitud.estado", entidad: "solicitud", entidadId: id, detalle: { antes, despues } }, tx);
}

export async function cambiarEstado(id: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("solicitud.gestionar");
  const p = z.object({ estado: z.enum(["NUEVA", "EN_CURSO", "RESUELTA"], { error: "Elegí el estado." }) }).safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "solicitud" WHERE id = ${id} FOR UPDATE`;
    const s = await tx.solicitud.findUnique({ where: { id } });
    if (!s) return error("No encontramos esa solicitud.");
    if (s.estado === p.data.estado) return ok(`Ya estaba ${NOMBRE_ESTADO[s.estado].toLowerCase()}.`);
    await cambiar(tx, actor, id, s.estado, p.data.estado);
    return ok(`La solicitud pasó a ${NOMBRE_ESTADO[p.data.estado].toLowerCase()}.`);
  });
}

export async function agregarNota(id: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("solicitud.gestionar");
  const p = z
    .object({ texto: z.string({ error: "Escribí la nota." }).transform((s) => s.trim()).pipe(z.string().min(1, "Escribí la nota.").max(4000, "Es demasiado largo.")) })
    .safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const s = await db.solicitud.findUnique({ where: { id }, select: { id: true } });
  if (!s) return error("No encontramos esa solicitud.");
  await db.solicitudEvento.create({ data: { solicitudId: id, autorId: actor.userId, tipo: "NOTA_INTERNA", texto: p.data.texto } });
  return ok("Guardaste la nota interna. La unidad no la ve.");
}

// ---------------------------------------------------------------------------
// WhatsApp de la Administración (decisión 19)
// ---------------------------------------------------------------------------

export async function whatsappAdministracion(): Promise<string> {
  const c = await db.configuracion.findUnique({ where: { id: 1 }, select: { whatsapp: true } });
  return c?.whatsapp ?? "";
}

export async function guardarWhatsapp(input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("solicitud.gestionar");
  const texto = z.object({ whatsapp: z.string().optional() }).parse(input).whatsapp?.trim() ?? "";
  const numero = texto ? normalizarWhatsapp(texto) : "";
  if (numero === null) return error("Revisá los datos marcados.", { whatsapp: "Escribí un celular uruguayo, ej. 099 123 456." });
  await db.$transaction(async (tx) => {
    await tx.configuracion.upsert({ where: { id: 1 }, create: { id: 1, whatsapp: numero }, update: { whatsapp: numero } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "configuracion.whatsapp", entidad: "configuracion", entidadId: "1", detalle: { whatsapp: numero } }, tx);
  });
  return ok(numero ? "Guardaste el número de WhatsApp." : "Quitaste el número de WhatsApp: el botón deja de aparecer.");
}

export { NOMBRE_CATEGORIA };
