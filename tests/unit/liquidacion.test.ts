import { describe, expect, it } from "vitest";
import {
  calcularLiquidacion,
  cuotasPorLinea,
  descripcionLinea,
  sufijoVigente,
  type EntradaLiquidacion,
  type UnidadALiquidar,
} from "@/dominio/liquidacion/calculo";
import { formatearPorcentaje, porcentajePb, resumirEgresos, type RubroBase } from "@/dominio/liquidacion/egresos";
import { arrastrarDisponibilidades, calcularCuenta, DISPONIBILIDADES_VACIAS } from "@/dominio/liquidacion/disponibilidades";
import {
  enPeriodo,
  nombrePeriodo,
  parsearFecha,
  periodoAnterior,
  rangoPeriodo,
  siguientePeriodo,
  vencimiento,
} from "@/dominio/liquidacion/periodo";

/** $ a centésimos, para escribir los casos en pesos. */
const $ = (pesos: number) => Math.round(pesos * 100);

function unidad(p: Partial<UnidadALiquidar> & { unidadId: string; numero: string }): UnidadALiquidar {
  return {
    torre: 2,
    torreNombre: "A",
    torreOrden: 1,
    etiqueta: null,
    arrendada: false,
    gcUnidad: 0,
    gcPropietario: 0,
    gcGaraje: 0,
    cuotaExtraFr: 0,
    garajeACargoDe: "INQUILINO",
    ...p,
  };
}

const base = (p: Partial<EntradaLiquidacion>): EntradaLiquidacion => ({
  unidades: [],
  saldosAnteriores: [],
  pagos: [],
  cargos: [],
  tasaInteresPb: 100,
  tasaFondoReservaPb: 500,
  ...p,
});

describe("períodos y fechas", () => {
  it("avanza y retrocede de mes, también en el cambio de año", () => {
    expect(siguientePeriodo("2026-12")).toBe("2027-01");
    expect(periodoAnterior("2027-01")).toBe("2026-12");
    expect(nombrePeriodo("2026-09")).toBe("Setiembre 2026");
  });

  it("rango y vencimiento (día 25 del mes siguiente, sin pasarse del mes)", () => {
    expect(rangoPeriodo("2028-02")).toEqual({ desde: "2028-02-01", hasta: "2028-02-29" });
    expect(vencimiento("2026-10", 25)).toBe("2026-11-25");
    expect(vencimiento("2027-01", 31)).toBe("2027-02-28");
  });

  it("lee fechas en formato uruguayo y rechaza las imposibles", () => {
    expect(parsearFecha("5/10/2026")).toBe("2026-10-05");
    expect(parsearFecha("05-10-26")).toBe("2026-10-05");
    expect(parsearFecha("2026-10-05")).toBe("2026-10-05");
    expect(parsearFecha("31/11/2026")).toBeNull();
    expect(parsearFecha("10/2026")).toBeNull();
    expect(enPeriodo("2026-10-31", "2026-10")).toBe(true);
  });
});

describe("reglas de la liquidación (las del PDF modelo, con números ficticios)", () => {
  it("unidad A: saldo, interés del 1 % al peso, FR del 5 % y saldo a pagar", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [unidad({ unidadId: "u1", numero: "201", gcUnidad: $(5000), gcPropietario: $(300), gcGaraje: $(1200) })],
        saldosAnteriores: [{ unidadId: "u1", sufijo: "A", monto: $(10_250.5) }],
        pagos: [{ unidadId: "u1", sufijo: "A", monto: $(6_000) }],
      }),
    );
    const [l] = r.lineas;
    expect(l.codigo).toBe("2-201-A");
    expect(l.saldo).toBe($(4_250.5));
    // 1 % de 4.250,50 = 42,505 → 43 (al peso)
    expect(l.intereses).toBe($(43));
    expect(l.gcUnidad).toBe($(5_300));
    expect(l.gcGaraje).toBe($(1_200));
    // 5 % de 6.500 = 325
    expect(l.fondoReserva).toBe($(325));
    expect(l.saldoAPagar).toBe($(4_250.5 + 43 + 5_300 + 1_200 + 325));
  });

  it("sin interés si el saldo queda en cero o a favor", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [unidad({ unidadId: "u1", numero: "201", gcUnidad: $(5000) })],
        saldosAnteriores: [{ unidadId: "u1", sufijo: "A", monto: $(5_250) }],
        pagos: [{ unidadId: "u1", sufijo: "A", monto: $(6_000) }],
      }),
    );
    expect(r.lineas[0].saldo).toBe($(-750));
    expect(r.lineas[0].intereses).toBe(0);
    expect(r.lineas[0].saldoAPagar).toBe($(-750 + 5_000 + 250));
  });

  it("unidad alquilada: I paga el ordinario y el garaje; P la parte del propietario y todo el FR", () => {
    const u = unidad({ unidadId: "u1", numero: "301", arrendada: true, gcUnidad: $(6_000), gcPropietario: $(400), gcGaraje: $(1_500) });
    const r = calcularLiquidacion(base({ unidades: [u] }));
    const [p, i] = r.lineas;
    expect([p.codigo, i.codigo]).toEqual(["2-301-P", "2-301-I"]);
    expect(p.gcUnidad).toBe($(400));
    expect(p.gcGaraje).toBe(0);
    // FR sobre la unidad completa: 5 % de (6.000 + 400 + 1.500) = 395
    expect(p.fondoReserva).toBe($(395));
    expect(i.gcUnidad).toBe($(6_000));
    expect(i.gcGaraje).toBe($(1_500));
    expect(i.fondoReserva).toBe(0);
  });

  it("el garaje puede quedar a cargo del propietario", () => {
    const c = cuotasPorLinea(
      unidad({ unidadId: "u1", numero: "301", arrendada: true, gcUnidad: $(6_000), gcGaraje: $(1_500), garajeACargoDe: "PROPIETARIO" }),
      500,
    );
    expect(c.P!.gcGaraje).toBe($(1_500));
    expect(c.I!.gcGaraje).toBe(0);
  });

  it("FR al peso: 5 % de 4.567,89 = 228,39 → 228", () => {
    const c = cuotasPorLinea(unidad({ unidadId: "u1", numero: "1", gcUnidad: $(4_567.89) }), 500);
    expect(c.A!.fondoReserva).toBe($(228));
  });

  it("cargos extra van a su columna; los ajustes van a Otros e Intereses es solo el interés", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [unidad({ unidadId: "u1", numero: "201" })],
        cargos: [
          { unidadId: "u1", sufijo: "A", tipo: "OTROS", monto: $(450) },
          { unidadId: "u1", sufijo: "A", tipo: "BARBACOAS", monto: $(800) },
          { unidadId: "u1", sufijo: "A", tipo: "BARBACOAS", monto: $(200) },
          { unidadId: "u1", sufijo: "A", tipo: "MULTA", monto: $(1_000) },
          { unidadId: "u1", sufijo: "A", tipo: "OTROS", monto: $(-50) },
        ],
      }),
    );
    const [l] = r.lineas;
    expect([l.barbacoas, l.otros, l.multas, l.intereses]).toEqual([$(1_000), $(400), $(1_000), 0]);
    expect(l.saldoAPagar).toBe($(2_400));
  });

  it("cuota extra FR: la paga A, o P si está alquilada; no lleva el 5 %", () => {
    const sola = cuotasPorLinea(unidad({ unidadId: "u1", numero: "1", gcUnidad: $(4_000), cuotaExtraFr: $(1_000) }), 500);
    expect(sola.A!.cuotaExtraFr).toBe($(1_000));
    expect(sola.A!.fondoReserva).toBe($(200));
    const alquilada = cuotasPorLinea(unidad({ unidadId: "u1", numero: "1", arrendada: true, gcUnidad: $(4_000), cuotaExtraFr: $(1_000) }), 500);
    expect(alquilada.P!.cuotaExtraFr).toBe($(1_000));
    expect(alquilada.I!.cuotaExtraFr).toBe(0);
    const r = calcularLiquidacion(base({ unidades: [unidad({ unidadId: "u1", numero: "1", gcUnidad: $(4_000), cuotaExtraFr: $(1_000) })] }));
    expect(r.lineas[0].saldoAPagar).toBe($(4_000 + 200 + 1_000));
    expect(r.totales.cuotaExtraFr).toBe($(1_000));
  });

  it("totales: suma exacta de cada columna (sin errores de redondeo)", () => {
    const unidades = Array.from({ length: 50 }, (_, k) =>
      unidad({ unidadId: `u${k}`, numero: String(100 + k), gcUnidad: $(3_333.33), gcGaraje: k % 2 ? $(999.99) : 0 }),
    );
    const r = calcularLiquidacion(
      base({ unidades, saldosAnteriores: unidades.map((u) => ({ unidadId: u.unidadId, sufijo: "A" as const, monto: $(0.1) })) }),
    );
    expect(r.totales.saldoAnterior).toBe(500);
    expect(r.totales.gcUnidad).toBe($(3_333.33) * 50);
    expect(r.totales.saldoAPagar).toBe(r.lineas.reduce((s, l) => s + l.saldoAPagar, 0));
    for (const l of r.lineas) expect(Number.isInteger(l.saldoAPagar)).toBe(true);
  });

  it("ordena por torre y número natural, P antes que I", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [
          unidad({ unidadId: "c", numero: "1002" }),
          unidad({ unidadId: "z", numero: "101", torre: 3, torreNombre: "B", torreOrden: 2 }),
          unidad({ unidadId: "b", numero: "201", arrendada: true }),
          unidad({ unidadId: "a", numero: "001" }),
        ],
      }),
    );
    expect(r.lineas.map((l) => l.codigo)).toEqual(["2-001-A", "2-201-P", "2-201-I", "2-1002-A", "3-101-A"]);
    expect(r.lineas.map((l) => l.orden)).toEqual([0, 1, 2, 3, 4]);
  });

  it("descripción de la columna Id.", () => {
    expect(descripcionLinea({ torreNombre: "A", numero: "201", etiqueta: null }, "P")).toBe("A 201 (P)");
    expect(descripcionLinea({ torreNombre: "Garajes", numero: "14", etiqueta: "GGE 14" }, "A")).toBe("GGE 14");
  });
});

describe("cambio A ↔ P+I entre un mes y el siguiente", () => {
  it("reglas de reasignación de sufijo", () => {
    expect(sufijoVigente("A", true)).toBe("P");
    expect(sufijoVigente("I", true)).toBe("I");
    expect(sufijoVigente("P", false)).toBe("A");
    expect(sufijoVigente("I", false)).toBe("A");
  });

  it("se alquiló: el saldo de A queda en P y el inquilino arranca en cero", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [unidad({ unidadId: "u1", numero: "201", arrendada: true })],
        saldosAnteriores: [{ unidadId: "u1", sufijo: "A", monto: $(2_000) }],
      }),
    );
    expect(r.lineas.map((l) => [l.sufijo, l.saldoAnterior])).toEqual([
      ["P", $(2_000)],
      ["I", 0],
    ]);
  });

  it("se fue el inquilino: P e I vuelven a una sola línea A (pagos incluidos)", () => {
    const r = calcularLiquidacion(
      base({
        unidades: [unidad({ unidadId: "u1", numero: "201" })],
        saldosAnteriores: [
          { unidadId: "u1", sufijo: "P", monto: $(500) },
          { unidadId: "u1", sufijo: "I", monto: $(7_000) },
        ],
        pagos: [{ unidadId: "u1", sufijo: "I", monto: $(7_000) }],
      }),
    );
    expect(r.lineas).toHaveLength(1);
    expect(r.lineas[0].saldoAnterior).toBe($(7_500));
    expect(r.lineas[0].saldo).toBe($(500));
  });

  it("montos de unidades que ya no están activas se informan, no se pierden en silencio", () => {
    const r = calcularLiquidacion(base({ saldosAnteriores: [{ unidadId: "baja", sufijo: "A", monto: $(100) }] }));
    expect(r.sinUbicar).toEqual([{ unidadId: "baja", sufijo: "A", monto: $(100), origen: "saldo" }]);
  });
});

describe("resumen de egresos por rubro", () => {
  const rubros: RubroBase[] = [
    { id: "r2", codigo: "2", nombre: "Personal tercerizado", padreId: null, cargoPropietario: false, orden: 2 },
    { id: "r21", codigo: "2.1", nombre: "Portería", padreId: "r2", cargoPropietario: false, orden: 0 },
    { id: "r22", codigo: "2.2", nombre: "Limpieza", padreId: "r2", cargoPropietario: false, orden: 0 },
    { id: "r3", codigo: "3", nombre: "Servicios públicos", padreId: null, cargoPropietario: false, orden: 3 },
    { id: "r9", codigo: "9", nombre: "Seguro", padreId: null, cargoPropietario: true, orden: 9 },
    { id: "r91", codigo: "9.1", nombre: "Seguro de incendio", padreId: "r9", cargoPropietario: false, orden: 0 },
  ];

  it("agrupa por rubro padre con subtotal, porcentaje y total de cargo de propietarios", () => {
    const r = resumirEgresos(rubros, [
      { rubroId: "r22", monto: $(20_000) },
      { rubroId: "r21", monto: $(50_000) },
      { rubroId: "r21", monto: $(10_000) },
      { rubroId: "r3", monto: $(15_000) },
      { rubroId: "r91", monto: $(5_000) },
    ]);
    expect(r.total).toBe($(100_000));
    expect(r.rubros.map((g) => [g.rubro.codigo, g.total, g.porcentajePb])).toEqual([
      ["2", $(80_000), 8000],
      ["3", $(15_000), 1500],
      ["9", $(5_000), 500],
    ]);
    expect(r.rubros[0].subrubros.map((s) => [s.rubro.codigo, s.total])).toEqual([
      ["2.1", $(60_000)],
      ["2.2", $(20_000)],
    ]);
    expect(r.totalCargoPropietario).toBe($(5_000));
  });

  it("porcentajes en puntos básicos y su formato", () => {
    expect(porcentajePb(1, 3)).toBe(3333);
    expect(porcentajePb(2, 3)).toBe(6667);
    expect(porcentajePb(5, 0)).toBe(0);
    expect(formatearPorcentaje(6667)).toBe("66,67 %");
  });
});

describe("disponibilidades", () => {
  it("calcula ingresos, depósitos identificados, egresos y saldo final por fondo", () => {
    const d = { ...DISPONIBILIDADES_VACIAS, saldoInicial: { gc: $(100_000), fr: $(500_000), dni: $(8_000) }, ingresosFondoReserva: $(20_000) };
    const c = calcularCuenta(d, {
      totalPagos: $(400_000),
      totalDepositosNuevos: $(3_000),
      identificados: [{ codigo: "2-201-P", monto: $(2_500) }],
      totalEgresos: $(350_000),
      totalCargoPropietarios: $(30_000),
    });
    expect(c.ingresos).toEqual({ gc: $(380_000), fr: $(20_000), dni: $(3_000), total: $(403_000) });
    expect(c.egresosGastosComunes).toBe($(320_000));
    expect(c.saldoFinal.gc).toBe($(100_000 + 380_000 + 2_500 - 320_000 - 30_000));
    expect(c.saldoFinal.fr).toBe($(520_000));
    expect(c.saldoFinal.dni).toBe($(8_500));
    // El total cierra: inicial + ingresos − egresos.
    expect(c.saldoFinal.total).toBe(c.saldoInicial.total + c.ingresos.total - $(350_000));

    const sig = arrastrarDisponibilidades({ ...d, otras: [{ nombre: "Caja chica", moneda: "UYU", saldoInicial: $(5_000), movimientos: [{ concepto: "Compra", monto: $(-1_200) }] }] }, c);
    expect(sig.saldoInicial).toEqual({ gc: c.saldoFinal.gc, fr: c.saldoFinal.fr, dni: c.saldoFinal.dni });
    expect(sig.otras[0]).toEqual({ nombre: "Caja chica", moneda: "UYU", saldoInicial: $(3_800), movimientos: [] });
  });
});
