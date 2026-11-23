import { describe, expect, it } from "vitest";
import { categoriaDeSlug, enlaceWhatsapp, estadoAlResponder, normalizarWhatsapp } from "@/dominio/solicitudes";

describe("WhatsApp de la Administración", () => {
  it("normaliza celulares uruguayos a formato internacional", () => {
    expect(normalizarWhatsapp("099 123 456")).toBe("59899123456");
    expect(normalizarWhatsapp("+598 99 123 456")).toBe("59899123456");
    expect(normalizarWhatsapp("59899123456")).toBe("59899123456");
    expect(normalizarWhatsapp("99123456")).toBe("59899123456");
  });

  it("rechaza lo que no es un celular", () => {
    expect(normalizarWhatsapp("2901 2345")).toBeNull();
    expect(normalizarWhatsapp("hola")).toBeNull();
    expect(normalizarWhatsapp("")).toBeNull();
  });

  it("arma el enlace wa.me con categoría, unidad y asunto", () => {
    const url = enlaceWhatsapp("59899123456", { categoria: "Desperfecto", codigo: "2-201", asunto: "Pierde la canilla & el baño" });
    expect(url.startsWith("https://wa.me/59899123456?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Desperfecto · Unidad 2-201 · Pierde la canilla & el baño");
    expect(decodeURIComponent(enlaceWhatsapp("59899123456", { categoria: "Inquietud", asunto: "Ruidos" }).split("text=")[1])).toBe("Inquietud · Ruidos");
  });
});

describe("estados", () => {
  it("al responder una nueva pasa a en curso; se puede marcar resuelta", () => {
    expect(estadoAlResponder("NUEVA", false)).toBe("EN_CURSO");
    expect(estadoAlResponder("EN_CURSO", false)).toBe("EN_CURSO");
    expect(estadoAlResponder("RESUELTA", false)).toBe("RESUELTA");
    expect(estadoAlResponder("NUEVA", true)).toBe("RESUELTA");
  });

  it("cada sub-botón corresponde a una categoría", () => {
    expect(categoriaDeSlug("desperfectos")?.categoria).toBe("DESPERFECTO");
    expect(categoriaDeSlug("consultas")?.categoria).toBe("CONSULTA_GC");
    expect(categoriaDeSlug("inquietudes")?.categoria).toBe("INQUIETUD");
    expect(categoriaDeSlug("venta")).toBeNull();
  });
});
