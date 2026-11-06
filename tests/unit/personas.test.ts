import { describe, expect, it } from "vitest";
import {
  datosPersonaSchema,
  destinatariosDeUnidad,
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

describe("destinatarios de mail por unidad", () => {
  const dueno = { calidad: "PROPIETARIO" as const, email: "dueno@example.com", nombre: "Dueño" };
  const inq = { calidad: "INQUILINO" as const, email: "inq@example.com", nombre: "Inquilina" };

  it("sin alquilar: el responsable y los extras van con código A", () => {
    const r = destinatariosDeUnidad({
      arrendada: false,
      personasActivas: [dueno],
      extras: [{ email: "Socio@Example.com", nombre: null }],
    });
    expect(r).toEqual([
      { email: "dueno@example.com", nombre: "Dueño", sufijo: "A" },
      { email: "socio@example.com", nombre: null, sufijo: "A" },
    ]);
  });

  it("alquilada: el responsable y extras van con P, el inquilino con I", () => {
    const r = destinatariosDeUnidad({
      arrendada: true,
      personasActivas: [inq, dueno],
      extras: [{ email: "socio@example.com", nombre: "Socio" }],
    });
    expect(r.map((d) => [d.email, d.sufijo])).toEqual([
      ["dueno@example.com", "P"],
      ["inq@example.com", "I"],
      ["socio@example.com", "P"],
    ]);
  });

  it("no repite mails (extra igual al del responsable o al del inquilino)", () => {
    const r = destinatariosDeUnidad({
      arrendada: true,
      personasActivas: [dueno, inq],
      extras: [{ email: "DUENO@example.com", nombre: null }, { email: "inq@example.com", nombre: null }],
    });
    expect(r).toHaveLength(2);
  });

  it("un inquilino que quedó cargado en una unidad sin alquilar no recibe", () => {
    const r = destinatariosDeUnidad({ arrendada: false, personasActivas: [dueno, inq], extras: [] });
    expect(r.map((d) => d.email)).toEqual(["dueno@example.com"]);
  });
});
