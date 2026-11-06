import { describe, expect, it } from "vitest";
import {
  centesimos,
  formatearNumero,
  formatearPesos,
  parsearMonto,
  porcentajeAlPeso,
  restar,
  sumar,
} from "@/dominio/dinero";

describe("parsearMonto", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,5", 123450],
    ["12.000", 1200000],
    ["$U 12.000,00", 1200000],
    ["-2.523", -252300],
    ["1234.56", 123456],
    ["0", 0],
    ["  950 ", 95000],
  ])("%s → %i centésimos", (texto, esperado) => {
    expect(parsearMonto(texto)).toBe(esperado);
  });

  it.each(["", "abc", "1,2,3", "1.234,567", "12..0"])("rechaza %j", (texto) => {
    expect(() => parsearMonto(texto)).toThrow();
  });
});

describe("aritmética entera", () => {
  it("suma sin errores de float (0,1 + 0,2)", () => {
    expect(sumar(centesimos(10), centesimos(20))).toBe(30);
  });
  it("resta", () => {
    expect(restar(centesimos(484900), centesimos(490000))).toBe(-5100);
  });
  it("rechaza no enteros", () => {
    expect(() => centesimos(0.5)).toThrow(RangeError);
  });
});

describe("porcentajeAlPeso (redondeo como en la liquidación modelo)", () => {
  it.each([
    // [saldo en centésimos, puntos básicos, resultado en centésimos]
    [2224800, 100, 22200], // 1% de 22.248,00 = 222,48 → 222
    [899900, 100, 9000], // 1% de 8.999 = 89,99 → 90
    [5800, 100, 100], // 1% de 58 = 0,58 → 1
    [4900, 100, 0], // 1% de 49 = 0,49 → 0
    [5000, 100, 100], // 0,50 → 1 (half away from zero)
    [498000, 500, 24900], // 5% de 4.980 = 249
    [461800, 500, 23100], // 5% de 4.618 = 230,9 → 231
    [-5000, 100, -100],
  ])("%i × %i pb → %i", (monto, pb, esperado) => {
    expect(porcentajeAlPeso(centesimos(monto), pb)).toBe(esperado);
  });
});

describe("formato es-UY", () => {
  it("punto de miles y coma decimal", () => {
    expect(formatearNumero(centesimos(451354854))).toBe("4.513.548,54");
    expect(formatearNumero(centesimos(5))).toBe("0,05");
    expect(formatearNumero(centesimos(-196400))).toBe("-1.964,00");
  });
  it("con símbolo", () => {
    expect(formatearPesos(centesimos(1200000))).toBe("$U 12.000,00");
  });
});
