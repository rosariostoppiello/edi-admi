import { describe, expect, it } from "vitest";
import { ACCIONES, puede, type Accion, type Actor } from "@/dominio/permisos";

// Unidad U1: propietario P1 + inquilino I1. Unidad U2: otra unidad (A).
const U1 = "u1";
const U2 = "u2";

const actores = {
  admin: { userId: "a", rol: "ADMINISTRACION", unidades: [] },
  comision: { userId: "c", rol: "COMISION", unidades: [] },
  porteria: { userId: "p", rol: "PORTERIA", unidades: [] },
  propietario: {
    userId: "o",
    rol: "UNIDAD",
    unidades: [{ unidadId: U1, personaId: "P1", calidad: "PROPIETARIO" }],
  },
  inquilino: {
    userId: "i",
    rol: "UNIDAD",
    unidades: [{ unidadId: U1, personaId: "I1", calidad: "INQUILINO" }],
  },
  vecino: {
    userId: "v",
    rol: "UNIDAD",
    unidades: [{ unidadId: U2, personaId: "V1", calidad: "PROMITENTE" }],
  },
} satisfies Record<string, Actor>;

type NombreActor = keyof typeof actores;
const NOMBRES = Object.keys(actores) as NombreActor[];

/**
 * Matriz esperada: para cada acción, quién puede actuar sobre la unidad U1
 * (y, cuando aplica, sobre la persona indicada). Es la "fuente de verdad"
 * documentada en docs/PLAN.md §4.
 */
const MATRIZ: Record<Accion, { recurso?: { unidadId?: string; personaId?: string }; pueden: NombreActor[] }> = {
  "liquidacion.ver": { pueden: NOMBRES },
  "liquidacion.verConsolidado": { pueden: ["admin", "comision"] },
  "liquidacion.confeccionar": { pueden: ["admin"] },
  "liquidacion.publicar": { pueden: ["admin"] },
  "liquidacion.anular": { pueden: ["admin"] },
  "liquidacion.verCuentaUnidad": { recurso: { unidadId: U1 }, pueden: ["admin", "comision", "propietario", "inquilino"] },
  "reserva.ver": { pueden: NOMBRES },
  "reserva.crearParaUnidad": { recurso: { unidadId: U1 }, pueden: ["admin", "porteria", "propietario", "inquilino"] },
  "reserva.cancelarDeUnidad": { recurso: { unidadId: U1 }, pueden: ["admin", "porteria", "propietario", "inquilino"] },
  "reserva.configurarEspacios": { pueden: ["admin"] },
  "datos.verUnidad": { recurso: { unidadId: U1 }, pueden: ["admin", "comision", "propietario", "inquilino"] },
  // Editar los datos del inquilino I1: él mismo, el dueño y Administración.
  "datos.editarPersona": { recurso: { unidadId: U1, personaId: "I1" }, pueden: ["admin", "propietario", "inquilino"] },
  "datos.altaInquilino": { recurso: { unidadId: U1 }, pueden: ["admin", "propietario"] },
  "datos.bajaInquilino": { recurso: { unidadId: U1, personaId: "I1" }, pueden: ["admin", "propietario", "inquilino"] },
  "datos.gestionarDestinatarios": { recurso: { unidadId: U1 }, pueden: ["admin", "propietario"] },
  "datos.verTodos": { pueden: ["admin", "comision"] },
  "datos.verOcupantes": { pueden: ["admin", "comision", "porteria"] },
  "telefonos.ver": { pueden: NOMBRES },
  "telefonos.editar": { pueden: ["admin"] },
  "solicitud.crear": { recurso: { unidadId: U1 }, pueden: ["propietario", "inquilino"] },
  "solicitud.verDeUnidad": { recurso: { unidadId: U1 }, pueden: ["admin", "comision", "propietario", "inquilino"] },
  "solicitud.verTodas": { pueden: ["admin", "comision"] },
  "solicitud.gestionar": { pueden: ["admin"] },
  "comunicado.ver": { pueden: NOMBRES },
  "comunicado.publicar": { pueden: ["admin"] },
  "unidades.administrar": { pueden: ["admin"] },
  "usuarios.administrar": { pueden: ["admin"] },
  "auditoria.ver": { pueden: ["admin"] },
};

describe("matriz de permisos", () => {
  it("cubre todas las acciones", () => {
    expect(Object.keys(MATRIZ).sort()).toEqual([...ACCIONES].sort());
  });

  for (const accion of ACCIONES) {
    const { recurso, pueden } = MATRIZ[accion];
    for (const nombre of NOMBRES) {
      const esperado = pueden.includes(nombre);
      it(`${accion} · ${nombre} → ${esperado ? "sí" : "no"}`, () => {
        expect(puede(actores[nombre], accion, recurso)).toBe(esperado);
      });
    }
  }
});

describe("aislamiento entre unidades", () => {
  const sobreOtra = ACCIONES.filter((a) => MATRIZ[a].recurso?.unidadId);

  it.each(sobreOtra)("el vecino de U2 no puede %s sobre U1", (accion) => {
    expect(puede(actores.vecino, accion, MATRIZ[accion].recurso)).toBe(false);
  });

  it("una acción por unidad sin unidadId se deniega (no hay comodín)", () => {
    expect(puede(actores.propietario, "datos.verUnidad")).toBe(false);
    expect(puede(actores.admin, "datos.verUnidad")).toBe(false);
  });

  it("el inquilino no puede dar de baja ni editar al propietario", () => {
    expect(puede(actores.inquilino, "datos.bajaInquilino", { unidadId: U1, personaId: "P1" })).toBe(false);
    expect(puede(actores.inquilino, "datos.editarPersona", { unidadId: U1, personaId: "P1" })).toBe(false);
  });

  it("sin sesión no se puede nada", () => {
    for (const accion of ACCIONES) expect(puede(null, accion, { unidadId: U1 })).toBe(false);
  });

  it("un miembro de la Comisión que vive en U1 puede reservar para su unidad", () => {
    const comisionVecino: Actor = {
      userId: "cv",
      rol: "COMISION",
      unidades: [{ unidadId: U1, personaId: "P1", calidad: "PROPIETARIO" }],
    };
    expect(puede(comisionVecino, "reserva.crearParaUnidad", { unidadId: U1 })).toBe(true);
    expect(puede(comisionVecino, "reserva.crearParaUnidad", { unidadId: U2 })).toBe(false);
  });
});
