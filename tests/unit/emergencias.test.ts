import { describe, expect, it } from "vitest";
import { ESPERA_ENTRE_AVISOS_MIN, mensajeGeneral, minutosParaAvisar, primerTelefono } from "@/dominio/emergencias";

describe("minutosParaAvisar", () => {
  const ahora = new Date("2026-11-24T12:00:00Z");
  it("sin aviso previo se puede avisar", () => {
    expect(minutosParaAvisar(null, ahora)).toBe(0);
  });
  it("hay que esperar después de un aviso reciente", () => {
    expect(minutosParaAvisar(new Date("2026-11-24T11:58:30Z"), ahora)).toBe(4);
  });
  it("pasado el plazo se puede avisar de nuevo", () => {
    const antes = new Date(ahora.getTime() - ESPERA_ENTRE_AVISOS_MIN * 60_000);
    expect(minutosParaAvisar(antes, ahora)).toBe(0);
  });
});

describe("primerTelefono", () => {
  it("saca el primer número de un texto libre", () => {
    expect(primerTelefono("2600 1234 / 099 123 456 (noche)")).toBe("26001234");
    expect(primerTelefono("Cel. 099-123-456")).toBe("099123456");
    expect(primerTelefono("+598 99 123 456")).toBe("+59899123456");
  });
  it("sin número devuelve null", () => {
    expect(primerTelefono("")).toBeNull();
    expect(primerTelefono("a confirmar")).toBeNull();
    expect(primerTelefono(undefined)).toBeNull();
  });
});

describe("mensajeGeneral", () => {
  it("dice qué pasa y dónde, sin datos de quien avisó", () => {
    const m = mensajeGeneral("GAS", "Torre 2");
    expect(m).toContain("olor a gas o fuga de gas en Torre 2");
    expect(m).toContain("No prendas luces");
  });
  it("sin lugar dice el edificio", () => {
    expect(mensajeGeneral("OTRA", "  ")).toContain("otra emergencia en el edificio.");
  });
});
