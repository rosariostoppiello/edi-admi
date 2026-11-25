/**
 * Datos de ejemplo de la liquidación, 100 % FICTICIOS: rubros genéricos,
 * proveedores inventados, cuotas y pagos inventados. Nada sale del PDF real.
 *
 * Crea la liquidación de setiembre 2026 ya publicada (la primera, con saldos
 * iniciales), para que las unidades tengan algo que ver y la de octubre se
 * pueda preparar desde la app.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { calcularLiquidacion, type UnidadALiquidar } from "../src/dominio/liquidacion/calculo";
import { EDIFICIO } from "./seed-edificio";

const $ = (pesos: number) => Math.round(pesos * 100);
const PERIODO = "2026-09";
const fecha = (dia: number) => new Date(Date.UTC(2026, 8, dia));

const RUBROS: [string, string, boolean?][] = [
  ["1", "Personal"],
  ["1.1", "Portería"],
  ["1.2", "Limpieza de áreas comunes"],
  ["1.3", "Sueldos y cargas sociales"],
  ["2", "Consumos estatales"],
  ["2.1", "UTE espacios comunes"],
  ["2.2", "OSE"],
  ["2.3", "Tarifa de saneamiento"],
  ["3", "Mantenimiento"],
  ["3.1", "Ascensores"],
  ["3.2", "Bombas de agua"],
  ["3.3", "Sanitaria"],
  ["3.4", "Jardinería"],
  ["3.5", "Materiales y reparaciones"],
  ["4", "Gastos de administración"],
  ["4.1", "Honorarios de la administración"],
  ["4.2", "Comisiones bancarias"],
  ["5", "Obras especiales"],
  ["5.1", "Obras"],
  ["6", "Gastos de cargo de los propietarios", true],
  ["6.1", "Seguro de incendio"],
];

export async function sembrarLiquidacion(db: PrismaClient) {
  await db.configuracion.upsert({
    where: { edificioId: EDIFICIO },
    create: { edificioId: EDIFICIO },
    update: {},
  });
  await db.configuracion.update({
    where: { edificioId: EDIFICIO },
    data: {
      direccion: "Av. de Ejemplo 1234, Montevideo",
      procedimientoPago:
        "Los gastos comunes se depositan en la cuenta corriente en pesos del Banco de Ejemplo, a nombre del edificio, número 000-0000000.\n\n" +
        "Al depositar o transferir, indicá en la referencia el número de unidad completo (por ejemplo, 2-201-P). Los pagos sin referencia quedan como depósitos no identificados.\n\n" +
        "El vencimiento es el día 25 de cada mes. Pasada esa fecha, el saldo impago genera un interés del 1 % mensual.",
    },
  });

  // Rubros
  const ids = new Map<string, string>();
  for (const [codigo, nombre, cargoPropietario] of RUBROS) {
    const padre = codigo.includes(".") ? ids.get(codigo.split(".")[0]) : undefined;
    const r = await db.rubro.create({
      data: { edificioId: EDIFICIO, codigo, nombre, padreId: padre ?? null, cargoPropietario: cargoPropietario ?? false, orden: Number(codigo.split(".")[0]) },
    });
    ids.set(codigo, r.id);
  }

  // Egresos fijos (se precargan cada mes)
  const fijos = [
    { rubro: "1.1", proveedor: "Servicios de Portería Ejemplo SRL", detalle: "Agosto 2026", monto: $(420_000) },
    { rubro: "1.2", proveedor: "Limpieza Modelo SA", detalle: "Agosto 2026", monto: $(180_000) },
    { rubro: "3.1", proveedor: "Ascensores del Sur", detalle: "Agosto 2026", monto: $(65_000) },
    { rubro: "4.1", proveedor: "Administración Ejemplo", detalle: "Setiembre 2026", monto: $(48_000) },
    { rubro: "2.1", proveedor: "UTE", detalle: "Agosto 2026", monto: $(38_500) },
    { rubro: "2.2", proveedor: "OSE", detalle: "Agosto 2026", monto: $(22_300) },
  ];
  const fijosCreados: { id: string }[] = [];
  for (const f of fijos) {
    fijosCreados.push(await db.egresoFijo.create({ data: { rubroId: ids.get(f.rubro)!, proveedor: f.proveedor, detalle: f.detalle, monto: f.monto } }));
  }

  // Cuotas mensuales por unidad (inventadas, según piso)
  const unidades = await db.unidad.findMany({ where: { edificioId: EDIFICIO }, include: { torre: true }, orderBy: [{ torreId: "asc" }, { numero: "asc" }] });
  for (const [i, u] of unidades.entries()) {
    const piso = Number(u.numero[0]) || 1;
    const datos =
      u.tipo === "GARAJE"
        ? { gcUnidad: 0, gcPropietario: 0, gcGaraje: $(1_800) }
        : { gcUnidad: $(4_800 + piso * 450 + (u.numero.endsWith("2") ? 300 : 0)), gcPropietario: $(350), gcGaraje: i % 3 === 0 ? $(1_500) : 0 };
    await db.unidad.update({ where: { id: u.id }, data: { ...datos, garajeACargoDe: i % 7 === 0 ? "PROPIETARIO" : "INQUILINO" } });
  }
  const actualizadas = await db.unidad.findMany({ where: { edificioId: EDIFICIO }, include: { torre: true } });
  const aLiquidar: UnidadALiquidar[] = actualizadas.map((u) => ({
    unidadId: u.id,
    torre: u.torre.numero,
    torreNombre: u.torre.nombre,
    torreOrden: u.torre.orden,
    numero: u.numero,
    etiqueta: u.tipo === "GARAJE" ? u.etiqueta : null,
    arrendada: u.arrendada,
    gcUnidad: u.gcUnidad,
    cuotaExtraFr: u.cuotaExtraFr,
    gcPropietario: u.gcPropietario,
    gcGaraje: u.gcGaraje,
    garajeACargoDe: u.garajeACargoDe,
  }));

  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
  const liq = await db.liquidacion.create({
    data: {
      edificioId: EDIFICIO,
      periodo: PERIODO,
      tasaInteresPb: 100,
      tasaFondoReservaPb: 500,
      diaVencimiento: 25,
      procedimientoPago: (await db.configuracion.findUniqueOrThrow({ where: { edificioId: EDIFICIO } })).procedimientoPago,
      disponibilidades: {
        nombreCuenta: "Cuenta corriente Banco de Ejemplo",
        saldoInicial: { gc: $(312_450.3), fr: $(1_850_000), dni: $(6_200) },
        ingresosFondoReserva: $(14_000),
        otras: [
          { nombre: "Caja chica", moneda: "UYU", saldoInicial: $(8_000), movimientos: [{ concepto: "Artículos de ferretería", monto: $(-2_350) }] },
        ],
      },
    },
  });

  // Saldos iniciales: la mayoría debe el mes anterior; algunos atrasados, alguno a favor.
  const lineasBase = calcularLiquidacion({ unidades: aLiquidar, saldosAnteriores: [], pagos: [], cargos: [], tasaInteresPb: 100, tasaFondoReservaPb: 500 }).lineas;
  const saldos = lineasBase.map((l, i) => ({
    unidadId: l.unidadId,
    sufijo: l.sufijo,
    monto: i % 11 === 5 ? l.saldoAPagar * 3 : i % 13 === 7 ? -$(1_200) : l.saldoAPagar,
  }));
  await db.saldoInicial.createMany({ data: saldos.map((s) => ({ ...s, liquidacionId: liq.id })) });

  // Pagos: casi todos pagan lo que debían; algunos no pagan, otros pagan parcial.
  const pagos = saldos
    .map((s, i) => ({ ...s, monto: i % 9 === 4 ? 0 : i % 11 === 5 ? Math.floor(s.monto / 3 / 100) * 100 : s.monto }))
    .filter((p) => p.monto > 0);
  await db.ingreso.createMany({
    data: pagos.map((p, i) => ({
      liquidacionId: liq.id,
      unidadId: p.unidadId,
      sufijo: p.sufijo,
      fecha: fecha(5 + (i % 20)),
      monto: p.monto,
      referencia: `Transferencia ${100200 + i}`,
      origen: "EXCEL" as const,
      creadoPorId: admin.id,
    })),
  });

  // Egresos: los fijos + algunos variables.
  const variables = [
    { rubro: "2.3", proveedor: "Intendencia (tarifa de saneamiento)", detalle: "Bimestre julio-agosto", monto: $(54_120) },
    { rubro: "3.2", proveedor: "Bombas y Equipos SRL", detalle: "Service trimestral", monto: $(12_800) },
    { rubro: "3.5", proveedor: "Ferretería del Barrio", detalle: "Lámparas y cerraduras", monto: $(7_430.5) },
    { rubro: "4.2", proveedor: "Banco de Ejemplo", detalle: "Comisiones setiembre", monto: $(1_890) },
    { rubro: "6.1", proveedor: "Aseguradora Ejemplo", detalle: "Cuota 9/12 póliza de incendio", monto: $(21_500) },
  ];
  await db.egreso.createMany({
    data: [
      ...fijos.map((f, i) => ({ liquidacionId: liq.id, rubroId: ids.get(f.rubro)!, fecha: fecha(3 + i), proveedor: f.proveedor, detalle: f.detalle, monto: f.monto, fijoId: fijosCreados[i].id })),
      ...variables.map((v, i) => ({ liquidacionId: liq.id, rubroId: ids.get(v.rubro)!, fecha: fecha(12 + i), proveedor: v.proveedor, detalle: v.detalle, monto: v.monto })),
    ],
  });

  // Un par de cargos extra: barbacoa y un tag.
  const conCargo = lineasBase.filter((l) => l.sufijo !== "P").slice(2, 4);
  await db.cargoExtra.createMany({
    data: [
      { liquidacionId: liq.id, unidadId: conCargo[0].unidadId, sufijo: conCargo[0].sufijo, tipo: "BARBACOAS", concepto: "Barbacoa 14/09", monto: $(800) },
      { liquidacionId: liq.id, unidadId: conCargo[1].unidadId, sufijo: conCargo[1].sufijo, tipo: "OTROS", concepto: "Tag de garaje nuevo", monto: $(450) },
    ],
  });

  // Un depósito sin identificar.
  await db.depositoNoIdentificado.create({
    data: { fecha: fecha(18), forma: "Depósito en efectivo", documento: "998877", monto: $(5_350), cargadoEnId: liq.id },
  });

  // Publicar: foto de las líneas con el mismo cálculo que usa la app.
  const ingresos = await db.ingreso.findMany({ where: { liquidacionId: liq.id } });
  const cargos = await db.cargoExtra.findMany({ where: { liquidacionId: liq.id } });
  const { lineas } = calcularLiquidacion({
    unidades: aLiquidar,
    saldosAnteriores: saldos,
    pagos: ingresos,
    cargos,
    tasaInteresPb: 100,
    tasaFondoReservaPb: 500,
  });
  await db.lineaLiquidacion.createMany({ data: lineas.map((l) => ({ liquidacionId: liq.id, ...l })) });
  await db.liquidacion.update({
    where: { id: liq.id },
    data: { estado: "PUBLICADA", publicadaEn: new Date(Date.UTC(2026, 9, 2, 13)), publicadaPorId: admin.id },
  });
  return lineas.length;
}

/** Limpieza de las tablas de liquidación (antes de borrar unidades). */
export async function limpiarLiquidacion(db: PrismaClient) {
  await db.envioMail.deleteMany();
  await db.depositoNoIdentificado.deleteMany();
  await db.liquidacion.updateMany({ data: { rectificaId: null, pdfId: null } });
  await db.liquidacion.deleteMany();
  await db.archivo.deleteMany();
  await db.egresoFijo.deleteMany();
  await db.rubro.updateMany({ data: { padreId: null } });
  await db.rubro.deleteMany();
  await db.configuracion.deleteMany();
}
