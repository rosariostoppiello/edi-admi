import { describe, expect, it } from "vitest";
import {
  REGLAS_POR_DEFECTO,
  fechaEnFrase,
  fechaUy,
  finTurno,
  inicioTurno,
  leerReglas,
  limiteCancelacion,
  lunesDe,
  motivoParaNoReservar,
  puedeCancelarEnPlazo,
  sigueVigente,
  solariumDisponible,
  sufijoParaCobrar,
  sumarDias,
} from "@/dominio/reservas";

// Instante en hora de Uruguay (UTC−3).
const uy = (texto: string) => new Date(`${texto}-03:00`);
const reglas = REGLAS_POR_DEFECTO;

describe("turnos y horas de Uruguay", () => {
  it("el mediodía va de 11 a 17 y la noche de 19 a 2 del día siguiente", () => {
    expect(inicioTurno("2026-12-05", "MEDIODIA")).toEqual(uy("2026-12-05T11:00:00"));
    expect(finTurno("2026-12-05", "MEDIODIA")).toEqual(uy("2026-12-05T17:00:00"));
    expect(inicioTurno("2026-12-05", "NOCHE")).toEqual(uy("2026-12-05T19:00:00"));
    expect(finTurno("2026-12-05", "NOCHE")).toEqual(uy("2026-12-06T02:00:00"));
  });

  it("el día de calendario es el de Uruguay, no el de UTC", () => {
    expect(fechaUy(uy("2026-12-05T23:30:00"))).toBe("2026-12-05"); // en UTC ya es el 6
    expect(fechaUy(uy("2026-12-06T00:10:00"))).toBe("2026-12-06");
  });

  it("suma días cruzando meses y años, y busca el lunes", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(lunesDe("2026-11-29")).toBe("2026-11-23"); // domingo
    expect(lunesDe("2026-11-23")).toBe("2026-11-23");
    expect(fechaEnFrase("2026-12-05")).toBe("sábado 5 de diciembre");
  });
});

describe("reservar", () => {
  const ahora = uy("2026-11-23T10:00:00");
  const pedido = { ahora, reglas, activasDeLaUnidad: 0 };

  it("deja reservar un turno futuro dentro de la anticipación", () => {
    expect(motivoParaNoReservar({ ...pedido, fecha: "2026-11-23", turno: "MEDIODIA" })).toBeNull();
    expect(motivoParaNoReservar({ ...pedido, fecha: "2027-01-22", turno: "NOCHE" })).toBeNull(); // día 60
  });

  it("no deja reservar un turno que ya empezó", () => {
    const tarde = uy("2026-11-23T11:00:00");
    expect(motivoParaNoReservar({ ...pedido, ahora: tarde, fecha: "2026-11-23", turno: "MEDIODIA" })).toMatch(/ya empezó/);
    expect(motivoParaNoReservar({ ...pedido, fecha: "2026-11-22", turno: "NOCHE" })).toMatch(/ya pasó/);
  });

  it("no deja reservar con más de 60 días de anticipación", () => {
    expect(motivoParaNoReservar({ ...pedido, fecha: "2027-01-23", turno: "MEDIODIA" })).toMatch(/60 días/);
  });

  it("como máximo 2 reservas activas por unidad", () => {
    expect(motivoParaNoReservar({ ...pedido, activasDeLaUnidad: 1, fecha: "2026-12-01", turno: "NOCHE" })).toBeNull();
    expect(motivoParaNoReservar({ ...pedido, activasDeLaUnidad: 2, fecha: "2026-12-01", turno: "NOCHE" })).toMatch(/2 reservas activas/);
  });

  it("rechaza fechas inválidas", () => {
    expect(motivoParaNoReservar({ ...pedido, fecha: "2026-02-30", turno: "NOCHE" })).toMatch(/fecha válida/);
  });

  it("una reserva cuenta como activa hasta que termina su turno", () => {
    expect(sigueVigente("2026-11-22", "NOCHE", uy("2026-11-23T01:59:00"))).toBe(true);
    expect(sigueVigente("2026-11-22", "NOCHE", uy("2026-11-23T02:00:00"))).toBe(false);
  });
});

describe("cancelar hasta 48 horas antes", () => {
  it("el plazo se cuenta desde el inicio del turno", () => {
    expect(limiteCancelacion("2026-12-05", "NOCHE", reglas)).toEqual(uy("2026-12-03T19:00:00"));
    expect(puedeCancelarEnPlazo("2026-12-05", "NOCHE", uy("2026-12-03T19:00:00"), reglas)).toBe(true);
    expect(puedeCancelarEnPlazo("2026-12-05", "NOCHE", uy("2026-12-03T19:01:00"), reglas)).toBe(false);
    expect(puedeCancelarEnPlazo("2026-12-05", "MEDIODIA", uy("2026-12-03T19:00:00"), reglas)).toBe(false);
  });

  it("respeta las horas configuradas en el espacio", () => {
    const r = leerReglas({ horasCancelacion: 24 });
    expect(r).toEqual({ ...REGLAS_POR_DEFECTO, horasCancelacion: 24 });
    expect(puedeCancelarEnPlazo("2026-12-05", "NOCHE", uy("2026-12-04T18:00:00"), r)).toBe(true);
  });

  it("si las reglas guardadas están mal, usa las de por defecto", () => {
    expect(leerReglas(null)).toEqual(REGLAS_POR_DEFECTO);
    expect(leerReglas({ horasCancelacion: "mucho" })).toEqual(REGLAS_POR_DEFECTO);
  });
});

describe("solarium atado a su barbacoa", () => {
  const reservas = [{ fecha: "2026-12-05", turno: "NOCHE" as const }];
  it("no está disponible en el turno en que su barbacoa está reservada", () => {
    expect(solariumDisponible(reservas, "2026-12-05", "NOCHE")).toBe(false);
    expect(solariumDisponible(reservas, "2026-12-05", "MEDIODIA")).toBe(true);
    expect(solariumDisponible(reservas, "2026-12-06", "NOCHE")).toBe(true);
  });
});

describe("línea a la que se cobra la barbacoa", () => {
  it("la de quien reservó, ajustada a si la unidad sigue alquilada", () => {
    expect(sufijoParaCobrar("I", true)).toBe("I");
    expect(sufijoParaCobrar("P", true)).toBe("P");
    expect(sufijoParaCobrar("A", true)).toBe("P"); // reservó sin alquilar; ahora está alquilada
    expect(sufijoParaCobrar("I", false)).toBe("A"); // se fue el inquilino
    expect(sufijoParaCobrar("A", false)).toBe("A");
  });
});
