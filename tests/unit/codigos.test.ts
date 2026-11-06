import { describe, expect, it } from "vitest";
import { formatearCodigo, parsearCodigo, sufijosDeUnidad } from "@/dominio/codigos";

describe("códigos de unidad", () => {
  it("formatea con guiones", () => {
    expect(formatearCodigo({ torre: 2, numero: "201", sufijo: "P" })).toBe("2-201-P");
  });

  it.each([
    ["2-201-P", { torre: 2, numero: "201", sufijo: "P" }],
    ["2-201P", { torre: 2, numero: "201", sufijo: "P" }],
    [" 5-1001-a ", { torre: 5, numero: "1001", sufijo: "A" }],
    ["3 104 i", { torre: 3, numero: "104", sufijo: "I" }],
    ["2-001-I", { torre: 2, numero: "001", sufijo: "I" }],
  ])("parsea %j", (texto, esperado) => {
    expect(parsearCodigo(texto)).toEqual(esperado);
  });

  it.each(["", "201", "2-201", "2-201-X", "A-201-P"])("rechaza %j", (texto) => {
    expect(parsearCodigo(texto)).toBeNull();
  });

  it("A si no está arrendada, P+I si lo está", () => {
    expect(sufijosDeUnidad(false)).toEqual(["A"]);
    expect(sufijosDeUnidad(true)).toEqual(["P", "I"]);
  });
});
