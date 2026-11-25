import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, type UsuarioActual } from "./sesion";
import { desactivarSiNoTieneUnidades, enviarInvitacion, tieneContrasena, vincularUsuario } from "./invitaciones";
import { puede } from "@/dominio/permisos";
import {
  MENSAJE_TRANSICION,
  calidadDuenoSchema,
  datosPersonaSchema,
  destinatariosDeUnidad,
  emailSchema,
  esDueno,
  validarAltaInquilino,
  validarBajaInquilino,
} from "@/dominio/personas";

import { erroresDeZod, type Resultado } from "./resultado";
import { avisar } from "./mail";
import { equipoDelEdificio } from "./edificios";
import { codigoBase } from "@/dominio/codigos";

export type { Resultado };

/** Bloquea la fila de la unidad hasta el fin de la transacción (evita altas simultáneas). */
async function bloquearUnidad(tx: Prisma.TransactionClient, unidadId: string) {
  await tx.$queryRaw`SELECT id FROM "unidad" WHERE id = ${unidadId} FOR UPDATE`;
  const unidad = await tx.unidad.findUnique({
    where: { id: unidadId },
    include: { personas: { where: { activa: true } } },
  });
  if (!unidad) throw new Error("Unidad inexistente");
  return unidad;
}

function estado(unidad: Awaited<ReturnType<typeof bloquearUnidad>>) {
  return {
    arrendada: unidad.arrendada,
    personasActivas: unidad.personas.map((p) => ({ id: p.id, calidad: p.calidad, email: p.email })),
  };
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

/**
 * Ficha de una unidad. Un inquilino ve solo sus propios datos (no los del dueño):
 * Ley 18.331, mostrar solo lo necesario.
 */
export async function obtenerFicha(unidadId: string) {
  const usuario = await exigirPermiso("datos.verUnidad", { unidadId });
  const unidad = await db.unidad.findFirst({
    where: { id: unidadId, edificioId: usuario.edificio.id },
    include: {
      torre: true,
      personas: { where: { activa: true }, orderBy: { altaEn: "asc" } },
      destinatarios: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!unidad) return null;

  const vinculo = usuario.unidades.find((u) => u.unidadId === unidadId);
  const veTodo = puede(usuario, "datos.verTodos") || (vinculo && esDueno(vinculo.calidad));
  const personas = veTodo ? unidad.personas : unidad.personas.filter((p) => p.id === vinculo?.personaId);

  return {
    unidad,
    personas,
    destinatarios: puede(usuario, "datos.gestionarDestinatarios", { unidadId }) ? unidad.destinatarios : [],
    usuario,
    vinculo,
  };
}

/** Listado para Administración y Comisión (todas las unidades con sus responsables). */
export async function listarUnidades() {
  const usuario = await exigirPermiso("datos.verTodos");
  return db.unidad.findMany({
    where: { edificioId: usuario.edificio.id, activa: true },
    include: {
      torre: true,
      // Enum en orden PROPIETARIO, PROMITENTE, INQUILINO: el responsable aparece primero.
      personas: { where: { activa: true }, orderBy: { calidad: "asc" }, select: { nombre: true, calidad: true, datosConfirmadosEn: true } },
    },
    orderBy: [{ torre: { orden: "asc" } }, { numero: "asc" }],
  });
}

/** Para Portería: solo código de la unidad y nombre del ocupante. Nada de mails ni teléfonos. */
export async function listarOcupantes() {
  const usuario = await exigirPermiso("datos.verOcupantes");
  const unidades = await db.unidad.findMany({
    where: { edificioId: usuario.edificio.id, activa: true },
    select: {
      id: true,
      numero: true,
      arrendada: true,
      torre: { select: { numero: true, nombre: true, color: true, orden: true } },
      personas: { where: { activa: true }, select: { nombre: true, calidad: true } },
    },
    orderBy: [{ torre: { orden: "asc" } }, { numero: "asc" }],
  });
  return unidades.map((u) => {
    const ocupante = u.arrendada
      ? u.personas.find((p) => p.calidad === "INQUILINO")
      : u.personas.find((p) => esDueno(p.calidad));
    return { id: u.id, torre: u.torre.numero, torreColor: u.torre.color, torreNombre: u.torre.nombre, numero: u.numero, arrendada: u.arrendada, ocupante: ocupante?.nombre ?? "Sin datos" };
  });
}

/**
 * Destinatarios de la liquidación y los comunicados, por unidad. Uso interno del
 * servidor (envío al publicar): no va a la UI, así que no expone mails entre unidades.
 * Llamarla solo desde acciones que ya pasaron `exigirPermiso`.
 */
export async function destinatariosPorUnidad(edificioId: string) {
  const unidades = await db.unidad.findMany({
    where: { edificioId, activa: true },
    select: {
      id: true,
      arrendada: true,
      personas: { where: { activa: true }, select: { calidad: true, email: true, nombre: true } },
      destinatarios: { select: { email: true, nombre: true } },
    },
  });
  return unidades.map((u) => ({
    unidadId: u.id,
    destinatarios: destinatariosDeUnidad({ arrendada: u.arrendada, personasActivas: u.personas, extras: u.destinatarios }),
  }));
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

export async function editarPersona(unidadId: string, personaId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("datos.editarPersona", { unidadId, personaId });
  const esquema = datosPersonaSchema.extend({ calidad: calidadDuenoSchema.optional() });
  const parse = esquema.safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const datos = parse.data;

  let reinvitar: string | null = null;
  const r = await db.$transaction(async (tx): Promise<Resultado> => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const persona = unidad.personas.find((p) => p.id === personaId);
    if (!persona) return { ok: false, error: "Esa persona ya no figura en la unidad." };

    const calidad = esDueno(persona.calidad) ? (datos.calidad ?? persona.calidad) : persona.calidad;

    if (persona.userId && datos.email !== persona.email) {
      const otro = await tx.user.findUnique({ where: { email: datos.email }, select: { id: true } });
      if (otro && otro.id !== persona.userId) {
        return { ok: false, error: "Revisá los datos marcados.", campos: { email: "Ese mail ya lo usa otra persona del sistema." } };
      }
    }

    const propios = actor.unidades.some((u) => u.personaId === personaId);
    await tx.persona.update({
      where: { id: personaId },
      data: { ...datos, calidad, ...(propios ? { datosConfirmadosEn: new Date() } : {}) },
    });

    if (persona.userId) {
      // Es la misma persona en todas sus unidades: se actualizan sus otras fichas y el usuario.
      await tx.persona.updateMany({
        where: { userId: persona.userId, activa: true, id: { not: personaId } },
        data: { nombre: datos.nombre, telefono: datos.telefono, email: datos.email },
      });
      await tx.user.update({ where: { id: persona.userId }, data: { name: datos.nombre, email: datos.email } });
      if (datos.email !== persona.email && !(await tieneContrasena(persona.userId))) reinvitar = datos.email;
    }

    await registrarAuditoria(
      {
        usuarioId: actor.userId, edificioId: actor.edificio.id,
        accion: "persona.editada",
        entidad: "persona",
        entidadId: personaId,
        detalle: {
          unidadId,
          antes: { nombre: persona.nombre, telefono: persona.telefono, email: persona.email, calidad: persona.calidad },
          despues: { ...datos, calidad },
        },
      },
      tx,
    );
    const cambioMail = datos.email !== persona.email;
    return {
      ok: true,
      mensaje: cambioMail && propios ? `Guardado. Desde ahora ingresás con ${datos.email}.` : "Datos guardados.",
    };
  });
  if (r.ok && reinvitar) await enviarInvitacion(reinvitar);
  return r;
}

/** El dueño confirma sus datos y que la unidad NO está alquilada (queda con código A). */
export async function confirmarSinAlquilar(unidadId: string, personaId: string): Promise<Resultado> {
  const actor = await exigirPermiso("datos.editarPersona", { unidadId, personaId });
  return db.$transaction(async (tx) => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const persona = unidad.personas.find((p) => p.id === personaId && esDueno(p.calidad));
    if (!persona) return { ok: false, error: "Esa persona ya no figura en la unidad." } as const;
    if (unidad.arrendada) return { ok: false, error: "La unidad figura con inquilino. Dalo de baja si ya no está." } as const;
    await tx.persona.update({ where: { id: personaId }, data: { datosConfirmadosEn: new Date() } });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "unidad.confirmada_sin_alquilar", entidad: "unidad", entidadId: unidadId },
      tx,
    );
    return { ok: true, mensaje: "Listo. La unidad figura sin alquilar." } as const;
  });
}

export async function altaInquilino(unidadId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("datos.altaInquilino", { unidadId });
  const parse = datosPersonaSchema.safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const datos = parse.data;

  let invitar = false;
  const r = await db.$transaction(async (tx): Promise<Resultado> => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const error = validarAltaInquilino(estado(unidad), datos.email);
    if (error) return { ok: false, error: MENSAJE_TRANSICION[error] };

    const { userId, necesitaInvitacion } = await vincularUsuario(tx, datos.email, datos.nombre);
    invitar = necesitaInvitacion;
    const persona = await tx.persona.create({
      data: { unidadId, calidad: "INQUILINO", ...datos, userId },
    });
    await tx.unidad.update({ where: { id: unidadId }, data: { arrendada: true } });
    // Cargar el inquilino también confirma los datos del dueño que lo carga.
    const vinculo = actor.unidades.find((u) => u.unidadId === unidadId);
    if (vinculo) await tx.persona.update({ where: { id: vinculo.personaId }, data: { datosConfirmadosEn: new Date() } });

    await registrarAuditoria(
      {
        usuarioId: actor.userId, edificioId: actor.edificio.id,
        accion: "inquilino.alta",
        entidad: "unidad",
        entidadId: unidadId,
        detalle: { personaId: persona.id, nombre: datos.nombre, email: datos.email },
      },
      tx,
    );
    return {
      ok: true,
      mensaje: necesitaInvitacion
        ? `Inquilino cargado. Le mandamos a ${datos.email} un mail para que cree su contraseña.`
        : "Inquilino cargado. Ya puede ingresar con su usuario.",
    };
  });
  if (r.ok && invitar) await enviarInvitacion(datos.email);
  return r;
}

export async function bajaInquilino(unidadId: string, personaId: string): Promise<Resultado & { cerroSuSesion?: boolean }> {
  const actor = await exigirPermiso("datos.bajaInquilino", { unidadId, personaId });
  return db.$transaction(async (tx) => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const error = validarBajaInquilino(estado(unidad), personaId);
    if (error) return { ok: false, error: MENSAJE_TRANSICION[error] } as const;
    const persona = unidad.personas.find((p) => p.id === personaId)!;

    await tx.persona.update({ where: { id: personaId }, data: { activa: false, bajaEn: new Date() } });
    await tx.unidad.update({ where: { id: unidadId }, data: { arrendada: false } });
    await desactivarSiNoTieneUnidades(tx, persona.userId);

    const propia = actor.unidades.some((u) => u.personaId === personaId);
    await registrarAuditoria(
      {
        usuarioId: actor.userId, edificioId: actor.edificio.id,
        accion: "inquilino.baja",
        entidad: "unidad",
        entidadId: unidadId,
        detalle: { personaId, nombre: persona.nombre, porElPropioInquilino: propia },
      },
      tx,
    );
    return {
      ok: true,
      mensaje: propia ? "Te diste de baja como inquilino." : "Inquilino dado de baja. La unidad vuelve a figurar con código A.",
      cerroSuSesion: propia,
    } as const;
  });
}

const destinatarioSchema = z.object({
  email: emailSchema,
  nombre: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(120))
    .optional(),
});

export async function agregarDestinatario(unidadId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("datos.gestionarDestinatarios", { unidadId });
  const parse = destinatarioSchema.safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const { email, nombre } = parse.data;
  const cantidad = await db.destinatarioExtra.count({ where: { unidadId } });
  if (cantidad >= 5) return { ok: false, error: "Podés agregar hasta 5 mails extra por unidad." };
  const existe = await db.destinatarioExtra.findUnique({ where: { unidadId_email: { unidadId, email } } });
  if (existe) return { ok: false, error: "Revisá los datos marcados.", campos: { email: "Ese mail ya está en la lista." } };
  await db.$transaction(async (tx) => {
    const d = await tx.destinatarioExtra.create({ data: { unidadId, email, nombre: nombre || null } });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "destinatario.alta", entidad: "unidad", entidadId: unidadId, detalle: { id: d.id, email } },
      tx,
    );
  });
  return { ok: true, mensaje: `Agregamos ${email}. Va a recibir las liquidaciones y comunicados.` };
}

export async function quitarDestinatario(unidadId: string, destinatarioId: string): Promise<Resultado> {
  const actor = await exigirPermiso("datos.gestionarDestinatarios", { unidadId });
  const d = await db.destinatarioExtra.findFirst({ where: { id: destinatarioId, unidadId } });
  if (!d) return { ok: false, error: "Ese mail ya no está en la lista." };
  await db.$transaction(async (tx) => {
    await tx.destinatarioExtra.delete({ where: { id: d.id } });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "destinatario.baja", entidad: "unidad", entidadId: unidadId, detalle: { email: d.email } },
      tx,
    );
  });
  return { ok: true, mensaje: `Quitamos ${d.email}.` };
}

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

const nuevaUnidadSchema = datosPersonaSchema.extend({
  torreId: z.coerce.number({ error: "Elegí la torre." }).int(),
  numero: z
    .string({ error: "Completá el número." })
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(/^[0-9A-Z]{1,6}$/, "El número solo puede tener números y letras (ej. 201 o 001).")),
  tipo: z.enum(["APTO", "LOCAL", "GARAJE", "OFICINA"], { error: "Elegí el tipo de unidad." }),
  etiqueta: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(60))
    .optional(),
  calidad: calidadDuenoSchema,
});

export async function crearUnidad(input: unknown): Promise<Resultado & { unidadId?: string }> {
  const actor = await exigirPermiso("unidades.administrar");
  const parse = nuevaUnidadSchema.safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const { torreId, numero, tipo, etiqueta, calidad, ...persona } = parse.data;

  const torre = await db.torre.findFirst({ where: { codigo: torreId, edificioId: actor.edificio.id } });
  if (!torre) return { ok: false, error: "Revisá los datos marcados.", campos: { torreId: "Esa torre no existe." } };
  const codigo = codigoBase(torre.numero, numero);
  const repetida = await db.unidad.findUnique({ where: { torreId_numero: { torreId, numero } } });
  if (repetida) return { ok: false, error: "Revisá los datos marcados.", campos: { numero: `Ya existe la unidad ${codigo}.` } };

  let invitar = false;
  const unidad = await db.$transaction(async (tx) => {
    const u = await tx.unidad.create({ data: { edificioId: actor.edificio.id, torreId, numero, tipo, etiqueta: etiqueta || null } });
    const { userId, necesitaInvitacion } = await vincularUsuario(tx, persona.email, persona.nombre);
    invitar = necesitaInvitacion;
    await tx.persona.create({ data: { unidadId: u.id, calidad, ...persona, userId } });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "unidad.alta", entidad: "unidad", entidadId: u.id, detalle: { codigo, tipo, responsable: persona.nombre } },
      tx,
    );
    return u;
  });
  if (invitar) await enviarInvitacion(persona.email);
  return { ok: true, mensaje: `Unidad ${codigo} creada.`, unidadId: unidad.id };
}

/** Venta de la unidad: el responsable anterior se da de baja y entra el nuevo. El inquilino (si hay) sigue. */
export async function cambiarPropietario(unidadId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("unidades.administrar");
  const parse = datosPersonaSchema.extend({ calidad: calidadDuenoSchema }).safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const { calidad, ...datos } = parse.data;

  let invitar = false;
  const r = await db.$transaction(async (tx): Promise<Resultado> => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const anteriores = unidad.personas.filter((p) => esDueno(p.calidad));
    if (unidad.personas.some((p) => p.calidad === "INQUILINO" && p.email === datos.email)) {
      return { ok: false, error: "Revisá los datos marcados.", campos: { email: "Ese mail es el del inquilino de la unidad." } };
    }
    for (const a of anteriores) {
      await tx.persona.update({ where: { id: a.id }, data: { activa: false, bajaEn: new Date() } });
    }
    const { userId, necesitaInvitacion } = await vincularUsuario(tx, datos.email, datos.nombre);
    invitar = necesitaInvitacion;
    await tx.persona.create({ data: { unidadId, calidad, ...datos, userId } });
    for (const a of anteriores) if (a.userId !== userId) await desactivarSiNoTieneUnidades(tx, a.userId);
    // El aviso de venta del propietario anterior queda resuelto con el cambio.
    await tx.solicitud.updateMany({
      where: { unidadId, categoria: "VENTA_UNIDAD", estado: { not: "RESUELTA" } },
      data: { estado: "RESUELTA", resueltaEn: new Date() },
    });
    await registrarAuditoria(
      {
        usuarioId: actor.userId, edificioId: actor.edificio.id,
        accion: "propietario.cambio",
        entidad: "unidad",
        entidadId: unidadId,
        detalle: { anteriores: anteriores.map((a) => a.nombre), nuevo: datos.nombre, calidad },
      },
      tx,
    );
    return { ok: true, mensaje: `Listo. ${datos.nombre} figura como responsable de la unidad.` };
  });
  if (r.ok && invitar) await enviarInvitacion(datos.email);
  return r;
}

/** Reenviar invitación a una persona que todavía no creó su contraseña. */
export async function reenviarInvitacion(unidadId: string, personaId: string): Promise<Resultado> {
  await exigirPermiso("datos.editarPersona", { unidadId, personaId });
  const persona = await db.persona.findFirst({ where: { id: personaId, unidadId, activa: true } });
  if (!persona?.userId) return { ok: false, error: "Esa persona ya no figura en la unidad." };
  if (await tieneContrasena(persona.userId)) return { ok: false, error: "Esa persona ya creó su contraseña." };
  await enviarInvitacion(persona.email);
  return { ok: true, mensaje: `Le reenviamos la invitación a ${persona.email}.` };
}

// ---------------------------------------------------------------------------
// Aviso de venta de la unidad (decisión 39). En la Fase 6 pasa a la bandeja de solicitudes.
// ---------------------------------------------------------------------------

const avisoVentaSchema = z.object({
  comentario: z
    .string()
    .trim()
    .max(1000, "Escribí hasta 1.000 caracteres.")
    .optional()
    .transform((v) => v || ""),
});

/** El propietario o promitente avisa que vendió: queda registrado y le llega un mail a Administración. */
export async function avisarVenta(unidadId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("datos.avisarVenta", { unidadId });
  const parse = avisoVentaSchema.safeParse(input);
  if (!parse.success) return erroresDeZod(parse.error);
  const { comentario } = parse.data;

  const r = await db.$transaction(async (tx) => {
    const unidad = await bloquearUnidad(tx, unidadId);
    const previo = await tx.solicitud.findFirst({
      where: { unidadId, categoria: "VENTA_UNIDAD", estado: { not: "RESUELTA" } },
    });
    if (previo) return { ok: false as const, error: "Ya avisaste la venta de esta unidad. La Administración se va a comunicar con vos." };
    const torre = await tx.torre.findUnique({ where: { codigo: unidad.torreId } });
    const codigo = codigoBase(torre?.numero ?? unidad.torreId, unidad.numero);
    const quien = unidad.personas.find((p) => p.userId === actor.userId);
    const solicitud = await tx.solicitud.create({
      data: {
        unidadId,
        edificioId: actor.edificio.id,
        autorId: actor.userId,
        categoria: "VENTA_UNIDAD",
        origen: "UNIDAD",
        asunto: `Venta de la unidad ${codigo}`,
        texto: comentario || "El propietario avisó que vendió la unidad.",
      },
    });
    await registrarAuditoria(
      { usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "unidad.venta_avisada", entidad: "unidad", entidadId: unidadId, detalle: { solicitudId: solicitud.id } },
      tx,
    );
    return { ok: true as const, codigo, torre: torre?.nombre ?? "", nombre: quien?.nombre ?? actor.nombre };
  });
  if (!r.ok) return r;

  // Mail a Administración (fuera de la transacción: si falla, el aviso igual queda registrado).
  const admins = await equipoDelEdificio(actor.edificio.id, ["ADMINISTRACION"]);
  const base = process.env.BETTER_AUTH_URL ?? "";
  for (const a of admins) {
    await avisar({
      para: a.email,
      asunto: `Aviso de venta de la unidad ${r.codigo}`,
      texto: [
        `${r.nombre} avisó que vendió la unidad ${r.codigo} (torre ${r.torre}).`,
        comentario ? `\nComentario:\n${comentario}` : "",
        `\nPara dar de alta al nuevo propietario, entrá a la ficha de la unidad y usá "Cambiar de propietario":`,
        `${base}/datos/${unidadId}`,
        `\n${actor.edificio.nombre}`,
      ].join("\n"),
    });
  }
  return { ok: true, mensaje: "Le avisamos a la Administración. Te van a pedir los datos del nuevo propietario para darle su usuario." };
}

/** Avisos de venta sin resolver de una unidad (para la ficha). */
export async function ventaPendiente(unidadId: string) {
  const usuario = await exigirPermiso("datos.verUnidad", { unidadId });
  const s = await db.solicitud.findFirst({
    where: { unidadId, categoria: "VENTA_UNIDAD", estado: { not: "RESUELTA" } },
    orderBy: { creadaEn: "desc" },
    select: { creadaEn: true, texto: true, autor: { select: { name: true } } },
  });
  if (!s) return null;
  // El comentario solo lo ve Administración; el propietario ve que ya avisó.
  return puede(usuario, "unidades.administrar") ? s : { creadaEn: s.creadaEn, texto: null, autor: null };
}

export type { UsuarioActual };
