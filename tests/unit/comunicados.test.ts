import { describe, expect, it } from "vitest";
import { MAX_PDF, errorDePdf, mover, nombreDescarga, tamanoLegible, tipoDeSlug } from "@/dominio/comunicados";

const pdf = new TextEncoder().encode("%PDF-1.4");

describe("PDF de un comunicado", () => {
  it("acepta un PDF de hasta 3 MB", () => {
    expect(errorDePdf({ nombre: "a.pdf", tamano: 1000, inicio: pdf })).toBeNull();
    expect(errorDePdf({ nombre: "a.pdf", tamano: MAX_PDF, inicio: pdf })).toBeNull();
  });
  it("rechaza vacíos, pesados y lo que no es PDF aunque se llame .pdf", () => {
    expect(errorDePdf({ nombre: "a.pdf", tamano: 0, inicio: pdf })).toMatch(/vacío/);
    expect(errorDePdf({ nombre: "a.pdf", tamano: MAX_PDF + 1, inicio: pdf })).toMatch(/3 MB/);
    expect(errorDePdf({ nombre: "a.pdf", tamano: 10, inicio: new TextEncoder().encode("PK\u0003\u0004") })).toMatch(/no es un PDF/);
  });
  it("arma un nombre de descarga seguro", () => {
    expect(nombreDescarga("Reglamento de copropiedad (2024)")).toBe("reglamento-de-copropiedad-2024.pdf");
    expect(nombreDescarga("Acta N° 12 — asamblea ordinaria")).toBe("acta-n-12-asamblea-ordinaria.pdf");
    expect(nombreDescarga("¿?")).toBe("comunicado.pdf");
  });
  it("muestra el tamaño en KB o MB", () => {
    expect(tamanoLegible(2048)).toBe("2 KB");
    expect(tamanoLegible(1536 * 1024)).toBe("1,5 MB");
  });
});

describe("orden de los reglamentos", () => {
  it("sube y baja intercambiando con el vecino, sin salirse de la lista", () => {
    expect(mover(["a", "b", "c"], "b", "arriba")).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], "b", "abajo")).toEqual(["a", "c", "b"]);
    expect(mover(["a", "b", "c"], "a", "arriba")).toEqual(["a", "b", "c"]);
    expect(mover(["a", "b", "c"], "c", "abajo")).toEqual(["a", "b", "c"]);
  });
  it("cada sub-botón es un tipo", () => {
    expect(tipoDeSlug("actas")?.tipo).toBe("ACTA");
    expect(tipoDeSlug("otro")).toBeNull();
  });
});
