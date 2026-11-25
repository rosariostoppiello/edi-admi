import { describe, expect, it } from "vitest";
import { edificiosDelUsuario, resolverEdificioActivo, rolEnEdificio } from "@/dominio/edificios";

const A = { id: "a", nombre: "Edificio A" };
const B = { id: "b", nombre: "Edificio B" };

describe("resolverEdificioActivo", () => {
  it("con un solo edificio entra directo", () => {
    expect(resolverEdificioActivo([A], undefined)).toEqual({ edificio: A, elegido: true });
  });
  it("con varios y sin elegir, hay que elegir", () => {
    expect(resolverEdificioActivo([A, B], undefined)).toEqual({ edificio: A, elegido: false });
  });
  it("respeta el edificio elegido", () => {
    expect(resolverEdificioActivo([A, B], "b")).toEqual({ edificio: B, elegido: true });
  });
  it("un edificio que ya no es suyo no vale", () => {
    expect(resolverEdificioActivo([A, B], "otro")).toEqual({ edificio: A, elegido: false });
    expect(resolverEdificioActivo([A], "otro")).toEqual({ edificio: A, elegido: true });
  });
  it("sin edificios no hay edificio activo", () => {
    expect(resolverEdificioActivo([], "a")).toEqual({ edificio: null, elegido: false });
  });
});

describe("rolEnEdificio", () => {
  const membresias = [{ edificioId: "a", rol: "ADMINISTRACION" as const }];
  it("usa la membresía del edificio", () => {
    expect(rolEnEdificio(membresias, "a")).toBe("ADMINISTRACION");
  });
  it("sin membresía es Unidad", () => {
    expect(rolEnEdificio(membresias, "b")).toBe("UNIDAD");
  });
});

describe("edificiosDelUsuario", () => {
  it("junta membresías y unidades sin repetir", () => {
    expect(edificiosDelUsuario([{ edificioId: "a" }], [{ edificioId: "a" }, { edificioId: "b" }])).toEqual(["a", "b"]);
  });
});

import { leerTorres, modulosAGuardar } from "@/dominio/edificios";

describe("leerTorres", () => {
  it("lee número y nombre", () => {
    expect(leerTorres("1 Norte\nTorre 2 Sur\n3")).toEqual({
      torres: [
        { numero: 1, nombre: "Norte" },
        { numero: 2, nombre: "Sur" },
        { numero: 3, nombre: "Torre 3" },
      ],
    });
  });
  it("rechaza líneas sin número y torres repetidas", () => {
    expect(leerTorres("Norte")).toHaveProperty("error");
    expect(leerTorres("1\n1 Otra")).toEqual({ error: "La torre 1 está repetida." });
    expect(leerTorres("  ")).toHaveProperty("error");
  });
});

describe("modulosAGuardar", () => {
  it("con todos prendidos guarda vacío", () => {
    expect(modulosAGuardar(["/liquidaciones", "/reservas", "/solicitudes", "/comunicados", "/telefonos"])).toEqual([]);
  });
  it("guarda solo los válidos", () => {
    expect(modulosAGuardar(["/reservas", "/inventado"])).toEqual(["/reservas"]);
  });
});
