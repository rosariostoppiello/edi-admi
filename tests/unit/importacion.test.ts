import { describe, expect, it } from "vitest";
import {
  fechaDeCelda,
  leerCsv,
  montoDeCelda,
  validarEgresos,
  validarIngresos,
  validarSaldosIniciales,
  type RubroConocido,
  type UnidadConocida,
} from "@/dominio/liquidacion/importacion";

const unidades: UnidadConocida[] = [
  { unidadId: "u201", torre: 2, numero: "201", arrendada: false },
  { unidadId: "u301", torre: 2, numero: "301", arrendada: true },
];
const opciones = { periodo: "2026-10", unidades, existentes: [] };

describe("celdas", () => {
  it("montos: número de Excel, texto es-UY y texto con punto decimal", () => {
    expect(montoDeCelda(1234.5)).toBe(123450);
    expect(montoDeCelda(0.1 + 0.2)).toBe(30);
    expect(montoDeCelda("1.234,56")).toBe(123456);
    expect(montoDeCelda("$U 12.000")).toBe(1200000);
    expect(() => montoDeCelda(10.555)).toThrow("más de 2 decimales");
    expect(() => montoDeCelda("")).toThrow("vacío");
  });

  it("fechas: Date de Excel, número de serie y texto", () => {
    expect(fechaDeCelda(new Date(Date.UTC(2026, 9, 5)))).toBe("2026-10-05");
    expect(fechaDeCelda(46300)).toBe("2026-10-05");
    expect(fechaDeCelda("05/10/2026")).toBe("2026-10-05");
    expect(fechaDeCelda("ayer")).toBeNull();
  });

  it("CSV con punto y coma y comillas", () => {
    expect(leerCsv('Fecha;Unidad;Monto\n05/10/2026;2-201-A;"1.234,50"\n')).toEqual([
      ["Fecha", "Unidad", "Monto"],
      ["05/10/2026", "2-201-A", "1.234,50"],
      [""],
    ]);
  });
});

describe("planilla de ingresos", () => {
  it("acepta encabezados en cualquier orden y normaliza el código", () => {
    const r = validarIngresos(
      [
        ["Planilla de pagos"],
        ["Unidad", "Monto", "Fecha", "Referencia"],
        ["2-201a", 5000, "05/10/2026", "Transf. 123"],
        ["2-301-I", "6.500,00", "06/10/2026", ""],
        [null, null, null, null],
      ],
      opciones,
    );
    expect(r.error).toBeNull();
    expect(r.cantidadErrores).toBe(0);
    expect(r.filas.map((f) => [f.fila, f.codigo, f.unidadId, f.sufijo, f.fecha, f.monto, f.referencia])).toEqual([
      [3, "2-201-A", "u201", "A", "2026-10-05", 500000, "Transf. 123"],
      [4, "2-301-I", "u301", "I", "2026-10-06", 650000, null],
    ]);
    expect(r.totalValido).toBe(1150000);
  });

  it("marca cada error con su fila y un mensaje claro", () => {
    const r = validarIngresos(
      [
        ["Fecha", "Unidad", "Monto"],
        ["05/10/2026", "2-999-A", 100],
        ["05/10/2026", "2-201-P", 100],
        ["05/10/2026", "2-301-A", 100],
        ["32/10/2026", "2-201-A", 100],
        ["05/10/2026", "2-201-A", "-5"],
        ["05/10/2026", "cualquiera", "abc"],
      ],
      opciones,
    );
    expect(r.cantidadErrores).toBe(6);
    expect(r.filas.map((f) => f.errores[0])).toEqual([
      "La unidad 2-999 no existe.",
      "2-201-P: la unidad no está alquilada, usá 2-201-A.",
      "2-301-A: la unidad está alquilada, usá 2-301-P o -I.",
      'La fecha "32/10/2026" no es válida (usá dd/mm/aaaa).',
      "El monto tiene que ser mayor que cero.",
      '"cualquiera" no es un código de unidad válido (ej. 2-201-A).',
    ]);
    expect(r.filas[5].errores[1]).toBe('El monto no es válido ("abc").');
  });

  it("avisa (sin bloquear) fechas de otro mes y pagos repetidos", () => {
    const r = validarIngresos(
      [
        ["Fecha", "Unidad", "Monto"],
        ["30/09/2026", "2-201-A", 100],
        ["05/10/2026", "2-201-A", 100],
        ["05/10/2026", "2-201-A", 100],
      ],
      { ...opciones, existentes: [{ unidadId: "u201", sufijo: "A", fecha: "2026-10-05", monto: 10000 }] },
    );
    expect(r.cantidadErrores).toBe(0);
    expect(r.filas[0].avisos).toEqual(["La fecha es de otro mes."]);
    expect(r.filas[1].avisos).toEqual(["Ya hay un pago igual cargado (misma unidad, fecha y monto)."]);
    expect(r.filas[2].avisos).toContain("Igual a la fila 3.");
  });

  it("error general si faltan encabezados o no hay datos", () => {
    expect(validarIngresos([["Código", "Plata"]], opciones).error).toMatch(/encabezados/);
    expect(validarIngresos([["Fecha", "Unidad", "Monto"]], opciones).error).toMatch(/no tiene filas/);
  });
});

describe("planilla de saldos iniciales", () => {
  it("acepta saldos negativos (a favor) y rechaza unidades repetidas", () => {
    const r = validarSaldosIniciales(
      [
        ["Unidad", "Saldo"],
        ["2-201-A", "-1.500,25"],
        ["2-301-P", 0],
        ["2-301-I", 8000],
        ["2-201-A", 10],
      ],
      { unidades },
    );
    expect(r.filas.map((f) => f.monto)).toEqual([-150025, 0, 800000, 1000]);
    expect(r.filas[3].errores).toEqual(["La unidad ya aparece en la fila 2."]);
  });
});

describe("planilla de egresos", () => {
  const rubros: RubroConocido[] = [
    { id: "r3", codigo: "3", nombre: "Mantenimiento", hoja: false },
    { id: "r33", codigo: "3.3", nombre: "Sanitaria", hoja: true },
    { id: "r21", codigo: "2.1", nombre: "UTE espacios comunes", hoja: true },
  ];
  const enc = ["Fecha", "Rubro", "Proveedor", "Período", "Monto"];
  const op = { periodo: "2026-10", rubros, existentes: [] };

  it("lee fecha, rubro (texto o número de Excel), proveedor, período y monto", () => {
    const r = validarEgresos(
      [enc, ["05/10/2026", "3.3", "Sanitaria Ejemplo", "Setiembre 2026", "4.000"], [new Date(Date.UTC(2026, 9, 8)), 2.1, "UTE", "Setiembre 2026", 1500.5]],
      op,
    );
    expect(r.error).toBeNull();
    expect(r.cantidadErrores).toBe(0);
    expect(r.filas.map((f) => [f.rubroId, f.fecha, f.proveedor, f.detalle, f.monto])).toEqual([
      ["r33", "2026-10-05", "Sanitaria Ejemplo", "Setiembre 2026", 400000],
      ["r21", "2026-10-08", "UTE", "Setiembre 2026", 150050],
    ]);
    expect(r.totalValido).toBe(550050);
  });

  it("rubro inexistente o que agrupa otros, faltantes y monto inválido son errores", () => {
    const r = validarEgresos(
      [enc, ["05/10/2026", "9.9", "X", "Set", 10], ["05/10/2026", "3", "X", "Set", 10], ["05/10/2026", "3.3", "", "", "mil"]],
      op,
    );
    expect(r.cantidadErrores).toBe(3);
    expect(r.filas[0].errores).toContain("El rubro 9.9 no existe.");
    expect(r.filas[1].errores[0]).toMatch(/agrupa otros rubros/);
    expect(r.filas[2].errores).toEqual(
      expect.arrayContaining(["Falta el proveedor o ente.", "Falta el período al que corresponde (ej. Agosto 2026)."]),
    );
    expect(r.filas[2].errores.some((e) => e.startsWith("El monto"))).toBe(true);
  });

  it("avisa fecha de otro mes y egresos repetidos, sin bloquear", () => {
    const r = validarEgresos([enc, ["05/09/2026", "3.3", "Sanitaria", "Agosto", 100], ["05/09/2026", "3.3", "sanitaria", "Agosto", 100]], {
      ...op,
      existentes: [{ rubroId: "r33", fecha: "2026-09-05", proveedor: "Sanitaria", monto: 10000 }],
    });
    expect(r.cantidadErrores).toBe(0);
    expect(r.filas[0].avisos).toEqual(["La fecha de pago es de otro mes.", "Ya hay un egreso igual cargado (mismo rubro, fecha, proveedor y monto)."]);
    expect(r.filas[1].avisos).toContain("Igual a la fila 2.");
  });

  it("sin encabezados da un error general", () => {
    expect(validarEgresos([["a", "b"]], op).error).toMatch(/Fecha, Rubro, Proveedor/);
  });
});
