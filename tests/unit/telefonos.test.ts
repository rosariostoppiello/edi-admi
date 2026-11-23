import { describe, expect, it } from "vitest";
import { diasParaVencer, enlaceTelefono, estadoPoliza, fraseVencimiento, separarTelefonos } from "@/dominio/telefonos";

describe("teléfonos", () => {
  it("arma el enlace para llamar", () => {
    expect(enlaceTelefono("099 123 456")).toBe("tel:099123456");
    expect(enlaceTelefono("+598 2901 2345")).toBe("tel:+59829012345");
    expect(enlaceTelefono("—")).toBeNull();
  });
  it("separa varios teléfonos escritos juntos", () => {
    expect(separarTelefonos("099 123 456 / 2901 2345")).toEqual(["099 123 456", "2901 2345"]);
    expect(separarTelefonos("099 111 222 o 098 333 444")).toEqual(["099 111 222", "098 333 444"]);
    expect(separarTelefonos("")).toEqual([]);
  });
});

describe("vencimiento del seguro de incendio", () => {
  it("cuenta los días que faltan", () => {
    expect(diasParaVencer("2026-11-23", "2026-12-23")).toBe(30);
    expect(diasParaVencer("2026-12-30", "2027-01-02")).toBe(3);
    expect(diasParaVencer("2026-11-23", "2026-11-20")).toBe(-3);
  });
  it("avisa cuando faltan 30 días o menos", () => {
    expect(estadoPoliza("2026-11-23", "2026-12-24")).toBe("VIGENTE");
    expect(estadoPoliza("2026-11-23", "2026-12-23")).toBe("POR_VENCER");
    expect(estadoPoliza("2026-11-23", "2026-11-23")).toBe("POR_VENCER");
    expect(estadoPoliza("2026-11-23", "2026-11-22")).toBe("VENCIDA");
  });
  it("lo dice en palabras", () => {
    expect(fraseVencimiento("2026-11-23", "2026-11-23")).toBe("vence hoy");
    expect(fraseVencimiento("2026-11-23", "2026-11-24")).toBe("vence mañana");
    expect(fraseVencimiento("2026-11-23", "2026-12-05")).toBe("vence en 12 días");
    expect(fraseVencimiento("2026-11-23", "2026-11-22")).toBe("venció ayer");
    expect(fraseVencimiento("2026-11-23", "2026-11-20")).toBe("venció hace 3 días");
  });
});
