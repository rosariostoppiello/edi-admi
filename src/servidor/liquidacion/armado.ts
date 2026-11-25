import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { formatearCodigo, type Sufijo } from "@/dominio/codigos";
import { centesimos, type Centesimos } from "@/dominio/dinero";
import {
  calcularLiquidacion,
  totalizar,
  type Linea,
  type MontoDeLinea,
  type ResultadoLiquidacion,
  type UnidadALiquidar,
} from "@/dominio/liquidacion/calculo";
import {
  calcularCuenta,
  DISPONIBILIDADES_VACIAS,
  disponibilidadesSchema,
  saldoFinalOtra,
  type CuentaCalculada,
  type Disponibilidades,
} from "@/dominio/liquidacion/disponibilidades";
import { resumirEgresos, type ResumenEgresos } from "@/dominio/liquidacion/egresos";
import { fechaIso, periodoAnterior } from "@/dominio/liquidacion/periodo";

type Cliente = Prisma.TransactionClient | typeof db;

/** Unidades activas del edificio con lo necesario para liquidar. */
export async function unidadesALiquidar(edificioId: string, tx: Cliente = db): Promise<UnidadALiquidar[]> {
  const unidades = await tx.unidad.findMany({ where: { edificioId, activa: true }, include: { torre: true } });
  return unidades.map((u) => ({
    unidadId: u.id,
    torre: u.torre.numero,
    torreNombre: u.torre.nombre,
    torreOrden: u.torre.orden,
    numero: u.numero,
    etiqueta: u.etiqueta,
    arrendada: u.arrendada,
    gcUnidad: u.gcUnidad,
    gcPropietario: u.gcPropietario,
    gcGaraje: u.gcGaraje,
    cuotaExtraFr: u.cuotaExtraFr,
    garajeACargoDe: u.garajeACargoDe,
  }));
}

/** Liquidación publicada del período anterior (de donde salen los saldos). */
export async function publicadaAnterior(edificioId: string, periodo: string, tx: Cliente = db) {
  return tx.liquidacion.findFirst({ where: { edificioId, periodo: periodoAnterior(periodo), estado: "PUBLICADA" } });
}

/** ¿Hay alguna liquidación publicada (o anulada) antes de este período? Si no, es la primera. */
export async function esPrimera(edificioId: string, periodo: string, tx: Cliente = db) {
  return (await tx.liquidacion.count({ where: { edificioId, periodo: { lt: periodo }, estado: "PUBLICADA" } })) === 0;
}

export async function saldosAnteriores(liq: { id: string; edificioId: string; periodo: string }, tx: Cliente = db): Promise<MontoDeLinea[]> {
  const anterior = await publicadaAnterior(liq.edificioId, liq.periodo, tx);
  if (anterior) {
    const lineas = await tx.lineaLiquidacion.findMany({ where: { liquidacionId: anterior.id } });
    return lineas.map((l) => ({ unidadId: l.unidadId, sufijo: l.sufijo, monto: l.saldoAPagar }));
  }
  const iniciales = await tx.saldoInicial.findMany({ where: { liquidacionId: liq.id } });
  return iniciales.map((s) => ({ unidadId: s.unidadId, sufijo: s.sufijo, monto: s.monto }));
}

/** Calcula las líneas de un borrador con los datos actuales. */
export async function calcularBorrador(
  liq: { id: string; edificioId: string; periodo: string; tasaInteresPb: number; tasaFondoReservaPb: number },
  tx: Cliente = db,
): Promise<ResultadoLiquidacion> {
  // En serie: dentro de una transacción hay una sola conexión y no admite consultas en paralelo.
  const unidades = await unidadesALiquidar(liq.edificioId, tx);
  const saldos = await saldosAnteriores(liq, tx);
  const ingresos = await tx.ingreso.findMany({ where: { liquidacionId: liq.id }, select: { unidadId: true, sufijo: true, monto: true } });
  const cargos = await tx.cargoExtra.findMany({ where: { liquidacionId: liq.id }, select: { unidadId: true, sufijo: true, monto: true, tipo: true } });
  return calcularLiquidacion({
    unidades,
    saldosAnteriores: saldos,
    pagos: ingresos,
    cargos,
    tasaInteresPb: liq.tasaInteresPb,
    tasaFondoReservaPb: liq.tasaFondoReservaPb,
  });
}

export function leerDisponibilidades(json: unknown): Disponibilidades {
  const r = disponibilidadesSchema.safeParse(json ?? {});
  return r.success ? r.data : DISPONIBILIDADES_VACIAS;
}

export interface DepositoPendiente {
  id: string;
  fecha: string;
  forma: string;
  documento: string | null;
  monto: Centesimos;
}

export interface EgresoDetalle {
  id: string;
  rubroCodigo: string;
  rubroNombre: string;
  fecha: string;
  proveedor: string;
  detalle: string;
  monto: Centesimos;
  fijo: boolean;
}

export interface LiquidacionArmada {
  id: string;
  periodo: string;
  estado: "BORRADOR" | "PUBLICADA" | "ANULADA";
  diaVencimiento: number;
  procedimientoPago: string;
  tasaInteresPb: number;
  tasaFondoReservaPb: number;
  publicadaEn: Date | null;
  anuladaEn: Date | null;
  motivoAnulacion: string | null;
  rectificaId: string | null;
  lineas: Linea[];
  totales: ResultadoLiquidacion["totales"];
  sinUbicar: ResultadoLiquidacion["sinUbicar"];
  resumen: ResumenEgresos;
  egresos: EgresoDetalle[];
  disponibilidades: Disponibilidades;
  cuenta: CuentaCalculada;
  otrasCuentas: (Disponibilidades["otras"][number] & { saldoFinal: Centesimos })[];
  depositosPendientes: DepositoPendiente[];
  totalDepositosPendientes: Centesimos;
}

/**
 * Todo lo que muestra una liquidación (pantalla de revisión, vista publicada y PDF).
 * Si es borrador, las líneas se calculan en el momento; si está publicada o anulada,
 * se usan las líneas guardadas al publicar.
 */
export async function armarLiquidacion(id: string, edificioId: string, tx: Cliente = db): Promise<LiquidacionArmada | null> {
  const liq = await tx.liquidacion.findFirst({
    where: { id, edificioId },
    include: {
      egresos: { include: { rubro: true }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }] },
      lineas: { orderBy: { orden: "asc" } },
      ingresos: { select: { monto: true, origen: true } },
      depositosCargados: { select: { monto: true } },
      depositosIdentificados: { include: { ingreso: { include: { unidad: { include: { torre: true } } } } } },
    },
  });
  if (!liq) return null;

  let calculo: Pick<ResultadoLiquidacion, "lineas" | "totales" | "sinUbicar">;
  if (liq.estado === "BORRADOR") {
    calculo = await calcularBorrador(liq, tx);
  } else {
    const lineas: Linea[] = liq.lineas.map((l) => ({
      unidadId: l.unidadId,
      sufijo: l.sufijo,
      codigo: l.codigo,
      descripcion: l.descripcion,
      orden: l.orden,
      saldoAnterior: centesimos(l.saldoAnterior),
      pagos: centesimos(l.pagos),
      saldo: centesimos(l.saldo),
      intereses: centesimos(l.intereses),
      gcUnidad: centesimos(l.gcUnidad),
      gcGaraje: centesimos(l.gcGaraje),
      fondoReserva: centesimos(l.fondoReserva),
      cuotaExtraFr: centesimos(l.cuotaExtraFr),
      barbacoas: centesimos(l.barbacoas),
      otros: centesimos(l.otros),
      multas: centesimos(l.multas),
      saldoAPagar: centesimos(l.saldoAPagar),
    }));
    calculo = { lineas, totales: totalizar(lineas), sinUbicar: [] };
  }

  const rubros = await tx.rubro.findMany({ where: { edificioId } });
  const resumen = resumirEgresos(rubros, liq.egresos);
  const disponibilidades = leerDisponibilidades(liq.disponibilidades);

  const identificados = liq.depositosIdentificados
    .filter((d) => d.ingreso)
    .map((d) => ({
      codigo: formatearCodigo({ torre: d.ingreso!.unidad.torre.numero, numero: d.ingreso!.unidad.numero, sufijo: d.ingreso!.sufijo as Sufijo }),
      monto: d.monto,
    }));
  const cuenta = calcularCuenta(disponibilidades, {
    totalPagos: liq.ingresos.filter((i) => i.origen !== "DEPOSITO").reduce((s, i) => s + i.monto, 0),
    totalDepositosNuevos: liq.depositosCargados.reduce((s, d) => s + d.monto, 0),
    identificados,
    totalEgresos: resumen.total,
    totalCargoPropietarios: resumen.totalCargoPropietario,
  });

  // Depósitos sin identificar al cierre del período.
  const depositos = await tx.depositoNoIdentificado.findMany({
    where: { cargadoEn: { edificioId, periodo: { lte: liq.periodo }, estado: { not: "ANULADA" } } },
    include: { identificadoEn: { select: { periodo: true } } },
    orderBy: { fecha: "asc" },
  });
  const depositosPendientes = depositos
    .filter((d) => !d.identificadoEn || d.identificadoEn.periodo > liq.periodo)
    .map((d) => ({ id: d.id, fecha: fechaIso(d.fecha), forma: d.forma, documento: d.documento, monto: centesimos(d.monto) }));

  return {
    id: liq.id,
    periodo: liq.periodo,
    estado: liq.estado,
    diaVencimiento: liq.diaVencimiento,
    procedimientoPago: liq.procedimientoPago,
    tasaInteresPb: liq.tasaInteresPb,
    tasaFondoReservaPb: liq.tasaFondoReservaPb,
    publicadaEn: liq.publicadaEn,
    anuladaEn: liq.anuladaEn,
    motivoAnulacion: liq.motivoAnulacion,
    rectificaId: liq.rectificaId,
    ...calculo,
    resumen,
    egresos: liq.egresos.map((e) => ({
      id: e.id,
      rubroCodigo: e.rubro.codigo,
      rubroNombre: e.rubro.nombre,
      fecha: fechaIso(e.fecha),
      proveedor: e.proveedor,
      detalle: e.detalle,
      monto: centesimos(e.monto),
      fijo: e.fijoId !== null,
    })),
    disponibilidades,
    cuenta,
    otrasCuentas: disponibilidades.otras.map((o) => ({ ...o, saldoFinal: saldoFinalOtra(o) })),
    depositosPendientes,
    totalDepositosPendientes: centesimos(depositosPendientes.reduce((s, d) => s + d.monto, 0)),
  };
}

export async function configuracion(edificioId: string, tx: Cliente = db) {
  return (
    (await tx.configuracion.findUnique({ where: { edificioId } })) ??
    (await tx.configuracion.create({ data: { edificioId } }))
  );
}
