import { describe, expect, it } from "vitest";
import {
  datosPersonaSchema,
  validarAltaInquilino,
  validarBajaInquilino,
  type EstadoUnidad,
} from "@/dominio/personas";

describe("datos de la persona (nunca vacíos)", () => {
  it("normaliza espacios y mail", () => {
    const r = datosPersonaSchema.parse({ nombre: "  Ana   María  Silva ", telefono: " 099 123 456 ", email: " Ana@Example.COM " });
    expect(r).toEqual({ nombre: "Ana María Silva", telefono: "099 123 456", email: "ana@example.com" });
  });

  it.each([
    [{ nombre: "", telefono: "099123456", email: "a@example.com" }, "nombre"],
    [{ nombre: "   ", telefono: "099123456", email: "a@example.com" }, "nombre"],
    [{ nombre: "Ana", telefono: "", email: "a@example.com" }, "telefono"],
    [{ nombre: "Ana", telefono: "1234", email: "a@example.com" }, "telefono"],
    [{ nombre: "Ana", telefono: "099-abc", email: "a@example.com" }, "telefono"],
    [{ nombre: "Ana", telefono: "099123456", email: "" }, "email"],
    [{ nombre: "Ana", telefono: "099123456", email: "no-es-mail" }, "email"],
    [{ telefono: "099123456", email: "a@example.com" }, "nombre"],
  ])("rechaza %j (campo %s)", (datos, campo) => {
    const r = datosPersonaSchema.safeParse(datos);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toContain(campo);
  });

  it.each(["099 123 456", "+598 99 123 456", "2400-1234", "(02) 400 1234"])("acepta el teléfono %s", (telefono) => {
    expect(datosPersonaSchema.safeParse({ nombre: "Ana", telefono, email: "a@example.com" }).success).toBe(true);
  });
});

const sinAlquilar: EstadoUnidad = {
  arrendada: false,
  personasActivas: [{ id: "p", calidad: "PROPIETARIO", email: "duenio@example.com" }],
};
const alquilada: EstadoUnidad = {
  arrendada: true,
  personasActivas: [
    { id: "p", calidad: "PROMITENTE", email: "duenio@example.com" },
    { id: "i", calidad: "INQUILINO", email: "inq@example.com" },
  ],
};

describe("transición A → P+I (alta de inquilino)", () => {
  it("se puede si la unidad no está arrendada", () => {
    expect(validarAltaInquilino(sinAlquilar, "inq@example.com")).toBeNull();
  });
  it("no si ya tiene inquilino", () => {
    expect(validarAltaInquilino(alquilada, "otro@example.com")).toBe("YA_ARRENDADA");
  });
  it("no si la unidad no tiene dueño", () => {
    expect(validarAltaInquilino({ arrendada: false, personasActivas: [] }, "x@example.com")).toBe("SIN_DUENO");
  });
  it("no si el mail del inquilino es el del dueño", () => {
    expect(validarAltaInquilino(sinAlquilar, " DUENIO@example.com ")).toBe("MAIL_DEL_DUENO");
  });
});

describe("transición P+I → A (baja de inquilino)", () => {
  it("se puede dar de baja al inquilino", () => {
    expect(validarBajaInquilino(alquilada, "i")).toBeNull();
  });
  it("no se puede dar de baja al propietario por esta vía", () => {
    expect(validarBajaInquilino(alquilada, "p")).toBe("INQUILINO_NO_ENCONTRADO");
  });
  it("no si la unidad no está arrendada", () => {
    expect(validarBajaInquilino(sinAlquilar, "p")).toBe("NO_ARRENDADA");
  });
});
