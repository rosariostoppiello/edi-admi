import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, exigirUsuario, type UsuarioActual } from "./sesion";
import { unidadActiva } from "./unidad-activa";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { puede } from "@/dominio/permisos";
import { formatearCodigo, type Sufijo } from "@/dominio/codigos";
import { indexarUnidades, resolverUnidad } from "@/dominio/liquidacion/importacion";
import { montoSchema, textoOpcional, textoSchema } from "@/dominio/liquidacion/esquemas";
import { sufijoDePersona } from "@/lib/edificio";
import {
  DATOS_TURNO,
  esFecha,
  fechaEnFrase,
  fechaUy,
  leerReglas,
  motivoParaNoReservar,
  puedeCancelarEnPlazo,
  reglasSchema,
  sigueVigente,
  type Turno,
} from "@/dominio/reservas";

type Tx = Prisma.TransactionClient;

const aFecha = (f: string) => new Date(`${f}T00:00:00Z`);
const deFecha = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export async function listarEspacios(tipo?: "BARBACOA" | "SOLARIUM" | "LAUNDRY" | "OTRO", { soloActivos = true } = {}) {
  await exigirPermiso("reserva.ver");
  return db.espacio.findMany({
    where: { ...(tipo ? { tipo } : {}), ...(soloActivos ? { activo: true } : {}) },
    include: { barbacoa: { select: { id: true, nombre: true } } },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

export async function obtenerEspacio(id: string) {
  await exigirPermiso("reserva.ver");
  return db.espacio.findUnique({ where: { id } });
}

export interface Ocupacion {
  espacioId: string;
  fecha: string;
  turno: Turno;
  /** De una unidad del usuario. */
  propia: boolean;
  /** Solo para quien puede ver qué unidad reservó (Administración y Portería). */
  codigo?: string;
}

/**
 * Turnos ocupados entre dos fechas. A las demás unidades no se les dice qué
 * unidad reservó: solo libre u ocupado (Ley 18.331, decisión 47).
 */
export async function ocupacion(desde: string, hasta: string): Promise<Ocupacion[]> {
  const usuario = await exigirPermiso("reserva.ver");
  const veQuien = puede(usuario, "reserva.verQuien");
  const mias = new Set(usuario.unidades.map((u) => u.unidadId));
  const reservas = await db.reserva.findMany({
    where: { estado: "ACTIVA", fecha: { gte: aFecha(desde), lte: aFecha(hasta) } },
    select: { espacioId: true, fecha: true, turno: true, unidadId: true, sufijo: true, unidad: { select: { numero: true, torreId: true } } },
  });
  return reservas.map((r) => ({
    espacioId: r.espacioId,
    fecha: deFecha(r.fecha),
    turno: r.turno,
    propia: mias.has(r.unidadId),
    codigo: veQuien ? formatearCodigo({ torre: r.unidad.torreId, numero: r.unidad.numero, sufijo: r.sufijo }) : undefined,
  }));
}

export interface ReservaListada {
  id: string;
  espacio: string;
  fecha: string;
  turno: Turno;
  codigo: string;
  origen: "UNIDAD" | "PORTERIA_A_PEDIDO" | "ADMINISTRACION";
  pedidaPor: string | null;
  puedeCancelar: boolean;
  /** Cancelable por la unidad o Portería (dentro de las 48 h). */
  enPlazo: boolean;
  cobrada: boolean;
}

/**
 * Próximas reservas activas. La unidad ve las suyas; Administración y Portería, todas.
 */
export async function proximasReservas(): Promise<ReservaListada[]> {
  const usuario = await exigirPermiso("reserva.ver");
  const todas = puede(usuario, "reserva.verQuien");
  const ahora = new Date();
  const reservas = await db.reserva.findMany({
    where: {
      estado: "ACTIVA",
      fecha: { gte: aFecha(fechaUy(new Date(ahora.getTime() - 24 * 3600 * 1000))) },
      ...(todas ? {} : { unidadId: { in: usuario.unidades.map((u) => u.unidadId) } }),
    },
    include: {
      espacio: { select: { nombre: true, reglas: true } },
      unidad: { select: { numero: true, torreId: true } },
      cargos: { where: { liquidacion: { estado: { not: "ANULADA" } } }, select: { id: true } },
    },
    orderBy: [{ fecha: "asc" }, { turno: "asc" }],
  });
  return reservas
    .filter((r) => sigueVigente(deFecha(r.fecha), r.turno, ahora))
    .map((r) => {
      const fecha = deFecha(r.fecha);
      const enPlazo = puedeCancelarEnPlazo(fecha, r.turno, ahora, leerReglas(r.espacio.reglas));
      const cobrada = r.cargos.length > 0;
      const puedeCancelar =
        !cobrada &&
        puede(usuario, "reserva.cancelarDeUnidad", { unidadId: r.unidadId }) &&
        (enPlazo || puede(usuario, "reserva.cancelarFueraDePlazo"));
      return {
        id: r.id,
        espacio: r.espacio.nombre,
        fecha,
        turno: r.turno,
        codigo: formatearCodigo({ torre: r.unidad.torreId, numero: r.unidad.numero, sufijo: r.sufijo }),
        origen: r.origen,
        pedidaPor: r.pedidaPor,
        puedeCancelar,
        enPlazo,
        cobrada,
      };
    });
}

/** Códigos de línea vigentes, para que Portería o Administración elijan la unidad. */
export async function codigosParaReservar(): Promise<string[]> {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "reserva.verQuien")) return [];
  const unidades = await db.unidad.findMany({ where: { activa: true }, select: { numero: true, arrendada: true, torreId: true } });
  return unidades
    .flatMap((u) => (u.arrendada ? ["P", "I"] : ["A"]).map((s) => `${u.torreId}-${u.numero}-${s}`))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

// ---------------------------------------------------------------------------
// Reservar y cancelar
// ---------------------------------------------------------------------------

const reservaSchema = z.object({
  espacioId: z.string().min(1, "Elegí la barbacoa."),
  fecha: z.string().refine(esFecha, "Elegí una fecha válida."),
  turno: z.enum(["MEDIODIA", "NOCHE"], { error: "Elegí el turno." }),
  codigo: textoOpcional(20),
  pedidaPor: textoOpcional(80),
});

/** Para quién reserva: la unidad activa del usuario, o la que elige Portería/Administración por código. */
type Destino =
  | { error: Record<string, string> }
  | { error?: undefined; unidadId: string; sufijo: Sufijo; origen: "UNIDAD" | "PORTERIA_A_PEDIDO" | "ADMINISTRACION"; pedidaPor: string | null };

async function destino(usuario: UsuarioActual, codigo: string | null, pedidaPor: string | null): Promise<Destino> {
  if (usuario.rol === "ADMINISTRACION" || usuario.rol === "PORTERIA") {
    if (!codigo) return { error: { codigo: "Escribí el código de la unidad que pidió la reserva." } };
    if (usuario.rol === "PORTERIA" && !pedidaPor) return { error: { pedidaPor: "Anotá quién te pidió la reserva." } };
    const unidades = await db.unidad.findMany({ where: { activa: true }, select: { id: true, numero: true, arrendada: true, torreId: true } });
    const r = resolverUnidad(codigo, indexarUnidades(unidades.map((u) => ({ unidadId: u.id, torre: u.torreId, numero: u.numero, arrendada: u.arrendada }))));
    if ("error" in r) return { error: { codigo: r.error! } };
    return {
      unidadId: r.unidad.unidadId,
      sufijo: r.sufijo as Sufijo,
      origen: usuario.rol === "PORTERIA" ? ("PORTERIA_A_PEDIDO" as const) : ("ADMINISTRACION" as const),
      pedidaPor,
    };
  }
  const u = await unidadActiva(usuario);
  if (!u) return { error: { general: "Tu usuario no está vinculado a ninguna unidad." } };
  return { unidadId: u.unidadId, sufijo: sufijoDePersona(u.arrendada, u.calidad), origen: "UNIDAD" as const, pedidaPor: null };
}

export async function reservar(input: unknown): Promise<Resultado & { reservaId?: string }> {
  const usuario = await exigirPermiso("reserva.ver");
  const p = reservaSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const { espacioId, fecha, turno, codigo, pedidaPor } = p.data;

  const d = await destino(usuario, codigo, pedidaPor);
  if (d.error) return error(d.error.general ?? "Revisá los datos marcados.", d.error);
  await exigirPermiso("reserva.crearParaUnidad", { unidadId: d.unidadId });

  try {
    return await db.$transaction(async (tx) => {
      // Bloquea la unidad: dos reservas simultáneas de la misma unidad no saltean el máximo.
      await tx.$queryRaw`SELECT id FROM "unidad" WHERE id = ${d.unidadId} FOR UPDATE`;
      const espacio = await tx.espacio.findUnique({ where: { id: espacioId } });
      if (!espacio || !espacio.activo || espacio.tipo !== "BARBACOA") return error("Esa barbacoa no se puede reservar.");
      const reglas = leerReglas(espacio.reglas);
      const ahora = new Date();
      const activas = await activasDeLaUnidad(tx, d.unidadId, ahora);
      const motivo = motivoParaNoReservar({ fecha, turno, ahora, reglas, activasDeLaUnidad: activas });
      if (motivo) return error(motivo);

      const r = await tx.reserva.create({
        data: { espacioId, fecha: aFecha(fecha), turno, unidadId: d.unidadId, sufijo: d.sufijo, creadaPorId: usuario.userId, origen: d.origen, pedidaPor: d.pedidaPor },
      });
      await registrarAuditoria(
        { usuarioId: usuario.userId, accion: "reserva.creada", entidad: "reserva", entidadId: r.id, detalle: { espacio: espacio.nombre, fecha, turno, origen: d.origen } },
        tx,
      );
      return { ...ok(`Reservaste ${espacio.nombre} el ${fechaEnFrase(fecha)}, turno ${DATOS_TURNO[turno].nombre.toLowerCase()} (${DATOS_TURNO[turno].horario}).`), reservaId: r.id };
    });
  } catch (e) {
    // El índice único parcial impide reservar dos veces el mismo turno.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return error("Ese turno se acaba de reservar. Elegí otro.");
    }
    throw e;
  }
}

async function activasDeLaUnidad(tx: Tx, unidadId: string, ahora: Date) {
  const reservas = await tx.reserva.findMany({
    where: { unidadId, estado: "ACTIVA", espacio: { tipo: "BARBACOA" }, fecha: { gte: aFecha(fechaUy(new Date(ahora.getTime() - 24 * 3600 * 1000))) } },
    select: { fecha: true, turno: true },
  });
  return reservas.filter((r) => sigueVigente(deFecha(r.fecha), r.turno, ahora)).length;
}

export async function cancelar(reservaId: string): Promise<Resultado> {
  const usuario = await exigirPermiso("reserva.ver");
  const r = await db.reserva.findUnique({ where: { id: reservaId }, select: { unidadId: true } });
  if (!r) return error("No encontramos esa reserva.");
  await exigirPermiso("reserva.cancelarDeUnidad", { unidadId: r.unidadId });

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "reserva" WHERE id = ${reservaId} FOR UPDATE`;
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      include: { espacio: true, cargos: { where: { liquidacion: { estado: { not: "ANULADA" } } }, include: { liquidacion: { select: { periodo: true } } } } },
    });
    if (!reserva || reserva.estado !== "ACTIVA") return error("Esa reserva ya estaba cancelada.");
    const fecha = deFecha(reserva.fecha);
    const ahora = new Date();
    if (!sigueVigente(fecha, reserva.turno, ahora)) return error("Esa reserva ya pasó.");
    if (reserva.cargos.length > 0) {
      return error("Esa reserva ya se cargó en la liquidación: quitá el cargo de la confección antes de cancelarla.");
    }
    const reglas = leerReglas(reserva.espacio.reglas);
    const enPlazo = puedeCancelarEnPlazo(fecha, reserva.turno, ahora, reglas);
    if (!enPlazo && !puede(usuario, "reserva.cancelarFueraDePlazo")) {
      return error(`Ya no se puede cancelar: faltan menos de ${reglas.horasCancelacion} horas. Consultá con la Administración.`);
    }
    await tx.reserva.update({ where: { id: reservaId }, data: { estado: "CANCELADA", canceladaPorId: usuario.userId, canceladaEn: ahora } });
    await registrarAuditoria(
      { usuarioId: usuario.userId, accion: "reserva.cancelada", entidad: "reserva", entidadId: reservaId, detalle: { fecha, turno: reserva.turno, enPlazo } },
      tx,
    );
    return ok(`Cancelaste la reserva de ${reserva.espacio.nombre} del ${fechaEnFrase(fecha)}.`);
  });
}

// ---------------------------------------------------------------------------
// Configuración de espacios (Administración)
// ---------------------------------------------------------------------------

const enteroSchema = (campo: string) =>
  z
    .string({ error: `Completá ${campo}.` })
    .trim()
    .regex(/^\d+$/, `Escribí ${campo} como un número entero.`)
    .transform(Number);

const espacioSchema = z.object({
  nombre: textoSchema("el nombre", 80),
  tarifa: montoSchema({ campo: "la tarifa" }).refine((m) => m >= 0, "La tarifa no puede ser negativa."),
  descripcion: z.string().optional().transform((s) => s?.trim() ?? "").pipe(z.string().max(2000, "Es demasiado largo (máximo 2000 caracteres).")),
  activo: z.string().optional().transform((v) => v === "on" || v === "true"),
  anticipacionDias: enteroSchema("los días de anticipación"),
  maxActivasPorUnidad: enteroSchema("el máximo por unidad"),
  horasCancelacion: enteroSchema("las horas para cancelar"),
});

export async function guardarEspacio(espacioId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("reserva.configurarEspacios");
  const p = espacioSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const { anticipacionDias, maxActivasPorUnidad, horasCancelacion, ...datos } = p.data;
  const reglas = reglasSchema.safeParse({ anticipacionDias, maxActivasPorUnidad, horasCancelacion });
  if (!reglas.success) return erroresDeZod(reglas.error);

  return db.$transaction(async (tx) => {
    const antes = await tx.espacio.findUnique({ where: { id: espacioId } });
    if (!antes) return error("No encontramos ese espacio.");
    const repetido = await tx.espacio.findFirst({ where: { nombre: datos.nombre, id: { not: espacioId } } });
    if (repetido) return error("Revisá los datos marcados.", { nombre: "Ya hay un espacio con ese nombre." });
    await tx.espacio.update({ where: { id: espacioId }, data: { ...datos, reglas: reglas.data } });
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: "espacio.modificado",
        entidad: "espacio",
        entidadId: espacioId,
        detalle: { antes: { nombre: antes.nombre, tarifa: antes.tarifa, activo: antes.activo, reglas: antes.reglas }, despues: { ...datos, reglas: reglas.data } } as Prisma.InputJsonValue,
      },
      tx,
    );
    return ok(`Guardaste ${datos.nombre}.`);
  });
}

const nuevoEspacioSchema = z.object({
  nombre: textoSchema("el nombre", 80),
  tipo: z.enum(["BARBACOA", "SOLARIUM", "OTRO"], { error: "Elegí el tipo de espacio." }),
  torreId: z.string().optional().transform((v) => (v ? Number(v) : null)),
  barbacoaId: z.string().optional().transform((v) => v || null),
  tarifa: montoSchema({ campo: "la tarifa" }).refine((m) => m >= 0, "La tarifa no puede ser negativa."),
});

export async function crearEspacio(input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("reserva.configurarEspacios");
  const p = nuevoEspacioSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;
  if (d.tipo === "SOLARIUM" && !d.barbacoaId) return error("Revisá los datos marcados.", { barbacoaId: "Elegí la barbacoa a la que está atado el solarium." });

  return db.$transaction(async (tx) => {
    if (await tx.espacio.findUnique({ where: { nombre: d.nombre } })) return error("Revisá los datos marcados.", { nombre: "Ya hay un espacio con ese nombre." });
    if (d.barbacoaId) {
      const b = await tx.espacio.findUnique({ where: { id: d.barbacoaId }, include: { solarium: true } });
      if (!b || b.tipo !== "BARBACOA") return error("Revisá los datos marcados.", { barbacoaId: "Esa barbacoa no existe." });
      if (b.solarium) return error("Revisá los datos marcados.", { barbacoaId: `${b.nombre} ya tiene su solarium.` });
    }
    const orden = (await tx.espacio.count()) + 1;
    const e = await tx.espacio.create({
      data: {
        nombre: d.nombre,
        tipo: d.tipo,
        torreId: d.torreId,
        barbacoaId: d.tipo === "SOLARIUM" ? d.barbacoaId : null,
        tarifa: d.tipo === "BARBACOA" ? d.tarifa : 0,
        orden,
      },
    });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "espacio.creado", entidad: "espacio", entidadId: e.id, detalle: { nombre: d.nombre, tipo: d.tipo } }, tx);
    return ok(`Agregaste ${d.nombre}.`);
  });
}

export async function listarTorres() {
  await exigirPermiso("reserva.configurarEspacios");
  return db.torre.findMany({ where: { tipo: "TORRE" }, orderBy: { orden: "asc" } });
}
