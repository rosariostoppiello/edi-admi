import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";
import { exigirPermiso, type UsuarioActual } from "../sesion";
import { error, erroresDeZod, ok, type Resultado } from "../resultado";
import { fechaSchema, montoSchema, textoOpcional, textoSchema } from "@/dominio/liquidacion/esquemas";
import { arrastrarDisponibilidades, disponibilidadesSchema } from "@/dominio/liquidacion/disponibilidades";
import { indexarUnidades, resolverUnidad } from "@/dominio/liquidacion/importacion";
import { esPeriodo, periodoEnFrase, rangoPeriodo, siguientePeriodo } from "@/dominio/liquidacion/periodo";
import { formatearPesos, type Centesimos } from "@/dominio/dinero";
import { armarLiquidacion, configuracion, esPrimera } from "./armado";

type Tx = Prisma.TransactionClient;

class ErrorConfeccion extends Error {}

/**
 * Corre `fn` en una transacción con la liquidación bloqueada y verificando que
 * siga en borrador: una liquidación publicada no se modifica nunca.
 */
async function enBorrador(
  liquidacionId: string,
  fn: (tx: Tx, liq: { id: string; periodo: string }) => Promise<Resultado>,
): Promise<Resultado> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "liquidacion" WHERE id = ${liquidacionId} FOR UPDATE`;
      const liq = await tx.liquidacion.findUnique({ where: { id: liquidacionId }, select: { id: true, periodo: true, estado: true } });
      if (!liq) throw new ErrorConfeccion("No encontramos esa liquidación.");
      if (liq.estado !== "BORRADOR") throw new ErrorConfeccion("Esta liquidación ya está publicada: no se puede modificar.");
      return fn(tx, liq);
    });
  } catch (e) {
    if (e instanceof ErrorConfeccion) return error(e.message);
    throw e;
  }
}

async function unidadesConocidas(tx: Tx | typeof db = db) {
  const unidades = await tx.unidad.findMany({ where: { activa: true }, select: { id: true, numero: true, arrendada: true, torreId: true } });
  return unidades.map((u) => ({ unidadId: u.id, torre: u.torreId, numero: u.numero, arrendada: u.arrendada }));
}

/** Resuelve un código "2-201-A" contra las unidades actuales. */
async function resolverCodigo(tx: Tx, codigo: string) {
  const r = resolverUnidad(codigo, indexarUnidades(await unidadesConocidas(tx)));
  if ("error" in r) throw new ErrorCampo("codigo", r.error!);
  return r;
}

class ErrorCampo extends ErrorConfeccion {
  constructor(public campo: string, mensaje: string) {
    super(mensaje);
  }
}

async function conCampos(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ErrorCampo) return error("Revisá los datos marcados.", { [e.campo]: e.message });
    throw e;
  }
}

function auditar(tx: Tx, actor: UsuarioActual, accion: string, liquidacionId: string, detalle?: Prisma.InputJsonValue) {
  return registrarAuditoria({ usuarioId: actor.userId, accion, entidad: "liquidacion", entidadId: liquidacionId, detalle }, tx);
}

// ---------------------------------------------------------------------------
// Crear
// ---------------------------------------------------------------------------

/** Período que corresponde crear ahora (el siguiente al último publicado), o null si es la primera. */
export async function proximoPeriodo(): Promise<string | null> {
  const ultima = await db.liquidacion.findFirst({ where: { estado: "PUBLICADA" }, orderBy: { periodo: "desc" } });
  return ultima ? siguientePeriodo(ultima.periodo) : null;
}

export async function crearLiquidacion(input: { periodo?: string }): Promise<Resultado & { id?: string }> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const sugerido = await proximoPeriodo();
  const periodo = sugerido ?? input.periodo ?? "";
  if (!esPeriodo(periodo)) return error("Revisá los datos marcados.", { periodo: "Elegí el mes de la primera liquidación." });

  try {
    const id = await db.$transaction(async (tx) => {
      if (await tx.liquidacion.findFirst({ where: { estado: "BORRADOR" } })) {
        throw new ErrorConfeccion("Ya hay una liquidación en preparación. Terminala o eliminala antes de crear otra.");
      }
      if (await tx.liquidacion.findFirst({ where: { periodo, estado: { not: "ANULADA" } } })) {
        throw new ErrorConfeccion(`La liquidación de ${periodoEnFrase(periodo)} ya existe.`);
      }
      const cfg = await configuracion(tx);
      const anterior = await tx.liquidacion.findFirst({ where: { estado: "PUBLICADA" }, orderBy: { periodo: "desc" } });
      let disponibilidades: Prisma.InputJsonValue | undefined;
      if (anterior) {
        const armada = await armarLiquidacion(anterior.id, tx);
        if (armada) disponibilidades = arrastrarDisponibilidades(armada.disponibilidades, armada.cuenta);
      }
      const liq = await tx.liquidacion.create({
        data: {
          periodo,
          tasaInteresPb: cfg.tasaInteresPb,
          tasaFondoReservaPb: cfg.tasaFondoReservaPb,
          diaVencimiento: cfg.diaVencimiento,
          procedimientoPago: cfg.procedimientoPago,
          disponibilidades,
        },
      });
      // Precarga de egresos fijos: quedan con el monto habitual para revisar.
      const fijos = await tx.egresoFijo.findMany({ where: { activo: true } });
      const fecha = new Date(`${rangoPeriodo(periodo).desde}T00:00:00Z`);
      if (fijos.length) {
        await tx.egreso.createMany({
          data: fijos.map((f) => ({ liquidacionId: liq.id, rubroId: f.rubroId, fecha, proveedor: f.proveedor, detalle: f.detalle, monto: f.monto, fijoId: f.id })),
        });
      }
      await auditar(tx, actor, "liquidacion.creada", liq.id, { periodo, egresosFijos: fijos.length });
      return liq.id;
    });
    return { ...ok(`Creaste la liquidación de ${periodoEnFrase(periodo)}.`), id };
  } catch (e) {
    if (e instanceof ErrorConfeccion) return error(e.message);
    throw e;
  }
}

/** Elimina un borrador (no una rectificación: esa reemplaza a una anulada). */
export async function eliminarBorrador(liquidacionId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return enBorrador(liquidacionId, async (tx, liq) => {
    const l = await tx.liquidacion.findUnique({ where: { id: liq.id }, select: { rectificaId: true } });
    if (l?.rectificaId) return error("Es la corrección de una liquidación anulada: terminala y publicala.");
    await tx.liquidacion.delete({ where: { id: liq.id } });
    await auditar(tx, actor, "liquidacion.borrador_eliminado", liq.id, { periodo: liq.periodo });
    return ok(`Eliminaste el borrador de ${periodoEnFrase(liq.periodo)}.`);
  });
}

// ---------------------------------------------------------------------------
// Ingresos
// ---------------------------------------------------------------------------

const ingresoSchema = z.object({
  codigo: textoSchema("la unidad", 20),
  fecha: fechaSchema,
  monto: montoSchema({ positivo: true }),
  referencia: textoOpcional(120),
});

export async function agregarIngreso(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = ingresoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  return conCampos(() =>
    enBorrador(liquidacionId, async (tx, liq) => {
      const u = await resolverCodigo(tx, p.data.codigo);
      const ingreso = await tx.ingreso.create({
        data: {
          liquidacionId: liq.id,
          unidadId: u.unidad.unidadId,
          sufijo: u.sufijo,
          fecha: new Date(`${p.data.fecha}T00:00:00Z`),
          monto: p.data.monto,
          referencia: p.data.referencia,
          origen: "MANUAL",
          creadoPorId: actor.userId,
        },
      });
      await auditar(tx, actor, "ingreso.alta", liq.id, { ingresoId: ingreso.id, codigo: u.codigo, monto: p.data.monto });
      return ok(`Cargaste ${formatearPesos(p.data.monto as Centesimos)} a ${u.codigo}.`);
    }),
  );
}

export async function eliminarIngreso(liquidacionId: string, ingresoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return enBorrador(liquidacionId, async (tx, liq) => {
    const ing = await tx.ingreso.findFirst({ where: { id: ingresoId, liquidacionId: liq.id }, include: { deposito: true } });
    if (!ing) return error("Ese pago ya no está cargado.");
    if (ing.deposito) {
      await tx.depositoNoIdentificado.update({ where: { id: ing.deposito.id }, data: { identificadoEnId: null, ingresoId: null } });
    }
    await tx.ingreso.delete({ where: { id: ing.id } });
    await auditar(tx, actor, "ingreso.baja", liq.id, { ingresoId, monto: ing.monto, origen: ing.origen });
    return ok(ing.deposito ? "Quitaste el pago: el depósito vuelve a figurar sin identificar." : "Quitaste el pago.");
  });
}

// ---------------------------------------------------------------------------
// Depósitos no identificados
// ---------------------------------------------------------------------------

const depositoSchema = z.object({
  fecha: fechaSchema,
  forma: textoSchema("la forma de pago", 60),
  documento: textoOpcional(60),
  monto: montoSchema({ positivo: true }),
});

export async function cargarDeposito(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = depositoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  return enBorrador(liquidacionId, async (tx, liq) => {
    const d = await tx.depositoNoIdentificado.create({
      data: { ...p.data, fecha: new Date(`${p.data.fecha}T00:00:00Z`), cargadoEnId: liq.id },
    });
    await auditar(tx, actor, "deposito.alta", liq.id, { depositoId: d.id, monto: p.data.monto });
    return ok("Cargaste el depósito sin identificar.");
  });
}

export async function identificarDeposito(liquidacionId: string, depositoId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = z.object({ codigo: textoSchema("la unidad", 20) }).safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  return conCampos(() =>
    enBorrador(liquidacionId, async (tx, liq) => {
      const d = await tx.depositoNoIdentificado.findUnique({ where: { id: depositoId }, include: { cargadoEn: true } });
      if (!d || d.cargadoEn.periodo > liq.periodo) return error("Ese depósito no existe.");
      if (d.ingresoId) return error("Ese depósito ya está identificado.");
      const u = await resolverCodigo(tx, p.data.codigo);
      const ingreso = await tx.ingreso.create({
        data: {
          liquidacionId: liq.id,
          unidadId: u.unidad.unidadId,
          sufijo: u.sufijo,
          fecha: d.fecha,
          monto: d.monto,
          referencia: `Depósito ${d.forma}${d.documento ? ` ${d.documento}` : ""}`,
          origen: "DEPOSITO",
          creadoPorId: actor.userId,
        },
      });
      await tx.depositoNoIdentificado.update({ where: { id: d.id }, data: { identificadoEnId: liq.id, ingresoId: ingreso.id } });
      await auditar(tx, actor, "deposito.identificado", liq.id, { depositoId, codigo: u.codigo, monto: d.monto });
      return ok(`Asignaste el depósito a ${u.codigo}.`);
    }),
  );
}

export async function eliminarDeposito(liquidacionId: string, depositoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return enBorrador(liquidacionId, async (tx, liq) => {
    const d = await tx.depositoNoIdentificado.findFirst({ where: { id: depositoId, cargadoEnId: liq.id } });
    if (!d) return error("Solo podés quitar depósitos cargados en esta liquidación.");
    if (d.ingresoId) return error("Primero quitá el pago asignado a la unidad.");
    await tx.depositoNoIdentificado.delete({ where: { id: d.id } });
    await auditar(tx, actor, "deposito.baja", liq.id, { depositoId, monto: d.monto });
    return ok("Quitaste el depósito.");
  });
}

// ---------------------------------------------------------------------------
// Egresos
// ---------------------------------------------------------------------------

const egresoSchema = z.object({
  rubroId: z.string({ error: "Elegí el rubro." }).min(1, "Elegí el rubro."),
  fecha: fechaSchema,
  proveedor: textoSchema("el proveedor", 120),
  detalle: textoSchema("el período o detalle", 160),
  monto: montoSchema({ positivo: true }),
  fijo: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

export async function agregarEgreso(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = egresoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const { fijo, ...datos } = p.data;
  return enBorrador(liquidacionId, async (tx, liq) => {
    const rubro = await tx.rubro.findFirst({ where: { id: datos.rubroId, activo: true } });
    if (!rubro) return error("Revisá los datos marcados.", { rubroId: "Ese rubro no existe." });
    let fijoId: string | null = null;
    if (fijo) {
      const f = await tx.egresoFijo.create({ data: { rubroId: rubro.id, proveedor: datos.proveedor, detalle: datos.detalle, monto: datos.monto } });
      fijoId = f.id;
    }
    const e = await tx.egreso.create({ data: { ...datos, fecha: new Date(`${datos.fecha}T00:00:00Z`), liquidacionId: liq.id, fijoId } });
    await auditar(tx, actor, "egreso.alta", liq.id, { egresoId: e.id, rubro: rubro.codigo, monto: datos.monto, fijo });
    return ok(fijo ? "Cargaste el egreso. Desde el mes que viene se precarga solo." : "Cargaste el egreso.");
  });
}

const editarEgresoSchema = egresoSchema.omit({ fijo: true });

export async function editarEgreso(liquidacionId: string, egresoId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = editarEgresoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  return enBorrador(liquidacionId, async (tx, liq) => {
    const e = await tx.egreso.findFirst({ where: { id: egresoId, liquidacionId: liq.id } });
    if (!e) return error("Ese egreso ya no está cargado.");
    await tx.egreso.update({ where: { id: e.id }, data: { ...p.data, fecha: new Date(`${p.data.fecha}T00:00:00Z`) } });
    await auditar(tx, actor, "egreso.editado", liq.id, { egresoId, antes: e.monto, despues: p.data.monto });
    return ok("Guardaste el egreso.");
  });
}

export async function eliminarEgreso(liquidacionId: string, egresoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return enBorrador(liquidacionId, async (tx, liq) => {
    const e = await tx.egreso.findFirst({ where: { id: egresoId, liquidacionId: liq.id } });
    if (!e) return error("Ese egreso ya no está cargado.");
    await tx.egreso.delete({ where: { id: e.id } });
    await auditar(tx, actor, "egreso.baja", liq.id, { egresoId, monto: e.monto });
    return ok("Quitaste el egreso de este mes.");
  });
}

/** Deja de precargar un egreso fijo en los meses siguientes. */
export async function desactivarEgresoFijo(fijoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const f = await db.egresoFijo.findUnique({ where: { id: fijoId } });
  if (!f || !f.activo) return error("Ese egreso fijo ya no está activo.");
  await db.$transaction(async (tx) => {
    await tx.egresoFijo.update({ where: { id: f.id }, data: { activo: false } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "egreso_fijo.baja", entidad: "egreso_fijo", entidadId: f.id }, tx);
  });
  return ok(`"${f.proveedor}" ya no se precarga en los meses siguientes.`);
}

const rubroSchema = z.object({
  codigo: z
    .string({ error: "Completá el código." })
    .trim()
    .regex(/^\d{1,2}(\.\d{1,2}){0,2}$/, "Usá números separados por punto, ej. 4 o 4.12."),
  nombre: textoSchema("el nombre", 80),
  cargoPropietario: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

/** Agrega un rubro. El padre se deduce del código ("4.12" → rubro "4"). */
export async function agregarRubro(input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = rubroSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const { codigo, nombre, cargoPropietario } = p.data;
  if (await db.rubro.findUnique({ where: { codigo } })) return error("Revisá los datos marcados.", { codigo: `Ya existe el rubro ${codigo}.` });
  const codigoPadre = codigo.includes(".") ? codigo.slice(0, codigo.lastIndexOf(".")) : null;
  const padre = codigoPadre ? await db.rubro.findUnique({ where: { codigo: codigoPadre } }) : null;
  if (codigoPadre && !padre) return error("Revisá los datos marcados.", { codigo: `Primero creá el rubro ${codigoPadre}.` });
  await db.$transaction(async (tx) => {
    const r = await tx.rubro.create({ data: { codigo, nombre, padreId: padre?.id ?? null, cargoPropietario, orden: Number(codigo.split(".")[0]) } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "rubro.alta", entidad: "rubro", entidadId: r.id, detalle: { codigo, nombre } }, tx);
  });
  return ok(`Agregaste el rubro ${codigo} ${nombre}.`);
}

// ---------------------------------------------------------------------------
// Cargos extra (tag, barbacoa/otros, multas, intereses y otros)
// ---------------------------------------------------------------------------

const cargoSchema = z.object({
  codigo: textoSchema("la unidad", 20),
  tipo: z.enum(["BARBACOAS", "OTROS", "MULTA"], { error: "Elegí el tipo de cargo." }),
  concepto: textoSchema("el concepto", 120),
  monto: montoSchema(),
});

export async function agregarCargo(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = cargoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  if (p.data.monto === 0) return error("Revisá los datos marcados.", { monto: "El monto no puede ser cero." });
  if (p.data.monto < 0 && p.data.tipo !== "OTROS") {
    return error("Revisá los datos marcados.", { monto: "Solo un cargo de \"Otros\" puede ser negativo (un ajuste o una bonificación)." });
  }
  return conCampos(() =>
    enBorrador(liquidacionId, async (tx, liq) => {
      const u = await resolverCodigo(tx, p.data.codigo);
      const c = await tx.cargoExtra.create({
        data: { liquidacionId: liq.id, unidadId: u.unidad.unidadId, sufijo: u.sufijo, tipo: p.data.tipo, concepto: p.data.concepto, monto: p.data.monto },
      });
      await auditar(tx, actor, "cargo.alta", liq.id, { cargoId: c.id, codigo: u.codigo, tipo: p.data.tipo, monto: p.data.monto });
      return ok(`Cargaste ${formatearPesos(p.data.monto as Centesimos)} a ${u.codigo}.`);
    }),
  );
}

export async function eliminarCargo(liquidacionId: string, cargoId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return enBorrador(liquidacionId, async (tx, liq) => {
    const c = await tx.cargoExtra.findFirst({ where: { id: cargoId, liquidacionId: liq.id } });
    if (!c) return error("Ese cargo ya no está.");
    await tx.cargoExtra.delete({ where: { id: c.id } });
    await auditar(tx, actor, "cargo.baja", liq.id, { cargoId, monto: c.monto });
    return ok("Quitaste el cargo.");
  });
}

// ---------------------------------------------------------------------------
// Cuotas fijas por unidad (se arrastran de mes a mes)
// ---------------------------------------------------------------------------

const cuotasSchema = z.object({
  gcUnidad: montoSchema({ campo: "el gasto común" }),
  gcPropietario: montoSchema({ campo: "la parte del propietario" }),
  gcGaraje: montoSchema({ campo: "el garaje" }),
  cuotaExtraFr: montoSchema({ campo: "la cuota extra del fondo de reserva" }),
  garajeACargoDe: z.enum(["PROPIETARIO", "INQUILINO"]),
});

export async function guardarCuotas(unidadId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = cuotasSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  for (const [k, v] of Object.entries(p.data)) {
    if (typeof v === "number" && v < 0) return error("Revisá los datos marcados.", { [k]: "No puede ser negativo." });
  }
  const u = await db.unidad.findUnique({ where: { id: unidadId }, include: { torre: true } });
  if (!u) return error("Esa unidad no existe.");
  await db.$transaction(async (tx) => {
    await tx.unidad.update({ where: { id: unidadId }, data: p.data });
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: "cuotas.editadas",
        entidad: "unidad",
        entidadId: unidadId,
        detalle: {
          antes: {
            gcUnidad: u.gcUnidad,
            gcPropietario: u.gcPropietario,
            gcGaraje: u.gcGaraje,
            cuotaExtraFr: u.cuotaExtraFr,
            garajeACargoDe: u.garajeACargoDe,
          },
          despues: p.data,
        },
      },
      tx,
    );
  });
  return ok(`Guardaste las cuotas de ${u.torre.codigo}-${u.numero}.`);
}

// ---------------------------------------------------------------------------
// Fondos y parámetros
// ---------------------------------------------------------------------------

const parametrosSchema = z.object({
  tasaInteres: z.string().trim().regex(/^\d{1,2}([.,]\d{1,2})?$/, "Escribí el porcentaje, ej. 1 o 1,5."),
  tasaFondoReserva: z.string().trim().regex(/^\d{1,2}([.,]\d{1,2})?$/, "Escribí el porcentaje, ej. 5."),
  diaVencimiento: z.coerce.number({ error: "Elegí el día." }).int().min(1, "Entre 1 y 28.").max(28, "Entre 1 y 28."),
  procedimientoPago: z.string().trim().max(3000, "Es demasiado largo."),
  guardarComoPredeterminado: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});

/** "1,5" → 150 puntos básicos (sin floats). */
function aPuntosBasicos(t: string): number {
  const [e, d = ""] = t.replace(",", ".").split(".");
  return Number(e) * 100 + Number(d.padEnd(2, "0"));
}

export async function guardarParametros(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = parametrosSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const datos = {
    tasaInteresPb: aPuntosBasicos(p.data.tasaInteres),
    tasaFondoReservaPb: aPuntosBasicos(p.data.tasaFondoReserva),
    diaVencimiento: p.data.diaVencimiento,
    procedimientoPago: p.data.procedimientoPago,
  };
  return enBorrador(liquidacionId, async (tx, liq) => {
    await tx.liquidacion.update({ where: { id: liq.id }, data: datos });
    if (p.data.guardarComoPredeterminado) {
      await tx.configuracion.upsert({ where: { id: 1 }, create: { id: 1, ...datos }, update: datos });
    }
    await auditar(tx, actor, "liquidacion.parametros", liq.id, { ...datos, predeterminado: p.data.guardarComoPredeterminado });
    return ok("Guardaste los parámetros.");
  });
}

export async function guardarDisponibilidades(liquidacionId: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  const p = disponibilidadesSchema.safeParse(input);
  if (!p.success) return error("Revisá los montos de las cuentas: alguno no es válido.");
  return enBorrador(liquidacionId, async (tx, liq) => {
    await tx.liquidacion.update({ where: { id: liq.id }, data: { disponibilidades: p.data } });
    await auditar(tx, actor, "liquidacion.disponibilidades", liq.id);
    return ok("Guardaste las disponibilidades.");
  });
}

// ---------------------------------------------------------------------------
// Lecturas de la confección
// ---------------------------------------------------------------------------

export async function obtenerBorrador(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId } });
  if (!liq) return null;
  return { ...liq, primera: await esPrimera(liq.periodo) };
}

export async function borradorActual() {
  await exigirPermiso("liquidacion.confeccionar");
  return db.liquidacion.findFirst({ where: { estado: "BORRADOR" } });
}

export async function listarIngresos(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  return db.ingreso.findMany({
    where: { liquidacionId },
    include: { unidad: { include: { torre: true } } },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
  });
}

export async function listarDepositos(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId } });
  if (!liq) return [];
  const depositos = await db.depositoNoIdentificado.findMany({
    where: { cargadoEn: { periodo: { lte: liq.periodo }, estado: { not: "ANULADA" } } },
    include: { identificadoEn: { select: { id: true, periodo: true } }, ingreso: { include: { unidad: { include: { torre: true } } } } },
    orderBy: { fecha: "desc" },
  });
  // Pendientes y los identificados en esta liquidación.
  return depositos.filter((d) => !d.identificadoEn || d.identificadoEn.id === liq.id);
}

export async function listarEgresosYRubros(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  const [egresos, rubros, fijos] = await Promise.all([
    db.egreso.findMany({ where: { liquidacionId }, include: { rubro: true }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }] }),
    db.rubro.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { codigo: "asc" }] }),
    db.egresoFijo.findMany({ where: { activo: true }, include: { rubro: true }, orderBy: { proveedor: "asc" } }),
  ]);
  const proveedores = [...new Set((await db.egreso.findMany({ select: { proveedor: true }, distinct: ["proveedor"], take: 300 })).map((e) => e.proveedor))].sort();
  return { egresos, rubros, fijos, proveedores };
}

export async function listarCargos(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  return db.cargoExtra.findMany({
    where: { liquidacionId },
    include: { unidad: { include: { torre: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function listarCuotas() {
  await exigirPermiso("liquidacion.confeccionar");
  return db.unidad.findMany({
    where: { activa: true },
    include: { torre: true },
    orderBy: [{ torre: { orden: "asc" } }, { numero: "asc" }],
  });
}

/** Códigos de línea vigentes (para el autocompletado de los formularios). */
export async function codigosVigentes(): Promise<string[]> {
  await exigirPermiso("liquidacion.confeccionar");
  const unidades = await unidadesConocidas();
  return unidades
    .flatMap((u) => (u.arrendada ? ["P", "I"] : ["A"]).map((s) => `${u.torre}-${u.numero}-${s}`))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

export { unidadesConocidas, ErrorConfeccion };
