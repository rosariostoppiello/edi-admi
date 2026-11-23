/**
 * Matriz de permisos explícita. TODA server action y endpoint llama a `puede()`
 * (vía `exigir()` en servidor/permisos.ts). La UI solo la usa para ocultar botones.
 *
 * Dos tipos de permiso:
 * - Por rol: dependen solo de `actor.rol`.
 * - Por unidad: dependen de que el actor esté vinculado a esa unidad (Persona activa),
 *   sin importar su rol. Así un miembro de la Comisión que vive en el edificio
 *   también puede reservar para su propia unidad.
 */

export type Rol = "ADMINISTRACION" | "COMISION" | "PORTERIA" | "UNIDAD";
export type Calidad = "PROPIETARIO" | "PROMITENTE" | "INQUILINO";

export interface VinculoUnidad {
  unidadId: string;
  personaId: string;
  calidad: Calidad;
}

export interface Actor {
  userId: string;
  rol: Rol;
  unidades: VinculoUnidad[];
}

export const ACCIONES = [
  // Liquidación
  "liquidacion.ver", // listado y PDF de cada mes (el PDF es público para todo usuario)
  "liquidacion.verConsolidado", // pantalla con todas las unidades
  "liquidacion.confeccionar",
  "liquidacion.publicar",
  "liquidacion.anular",
  "liquidacion.verCuentaUnidad", // estado de cuenta de una unidad (requiere unidadId)
  // Reservas
  "reserva.ver",
  "reserva.crearParaUnidad", // requiere unidadId
  "reserva.cancelarDeUnidad", // requiere unidadId
  "reserva.configurarEspacios",
  // Datos de propietarios / inquilinos
  "datos.verUnidad", // requiere unidadId
  "datos.editarPersona", // requiere unidadId + personaId
  "datos.altaInquilino", // requiere unidadId
  "datos.bajaInquilino", // requiere unidadId + personaId
  "datos.gestionarDestinatarios", // mails extra de la unidad; requiere unidadId
  "datos.avisarVenta", // propietario o promitente avisa que vendió; requiere unidadId
  "datos.verTodos", // datos personales de todas las unidades (solo Administración, decisión 36)
  "datos.verOcupantes", // código + nombre del ocupante (Portería)
  // Teléfonos / servicios
  "telefonos.ver",
  "telefonos.editar",
  // Solicitudes
  "solicitud.crear", // requiere unidadId
  "solicitud.verDeUnidad", // requiere unidadId
  "solicitud.verTodas",
  "solicitud.gestionar",
  // Comunicados
  "comunicado.ver",
  "comunicado.publicar",
  // Administración del sistema
  "unidades.administrar",
  "usuarios.administrar",
  "auditoria.ver",
] as const;

export type Accion = (typeof ACCIONES)[number];

export interface Recurso {
  unidadId?: string;
  /** Persona sobre la que se actúa (editar datos, dar de baja inquilino). */
  personaId?: string;
}

const TODOS: Rol[] = ["ADMINISTRACION", "COMISION", "PORTERIA", "UNIDAD"];

/** Permisos que dependen solo del rol. */
const POR_ROL: Partial<Record<Accion, Rol[]>> = {
  "liquidacion.ver": TODOS,
  "liquidacion.verConsolidado": ["ADMINISTRACION", "COMISION"],
  "liquidacion.confeccionar": ["ADMINISTRACION"],
  "liquidacion.publicar": ["ADMINISTRACION"],
  "liquidacion.anular": ["ADMINISTRACION"],
  "reserva.ver": TODOS,
  "reserva.configurarEspacios": ["ADMINISTRACION"],
  "datos.verTodos": ["ADMINISTRACION"],
  "datos.verOcupantes": ["ADMINISTRACION", "COMISION", "PORTERIA"],
  "telefonos.ver": TODOS,
  "telefonos.editar": ["ADMINISTRACION"],
  "solicitud.verTodas": ["ADMINISTRACION", "COMISION"],
  "solicitud.gestionar": ["ADMINISTRACION"],
  "comunicado.ver": TODOS,
  "comunicado.publicar": ["ADMINISTRACION"],
  "unidades.administrar": ["ADMINISTRACION"],
  "usuarios.administrar": ["ADMINISTRACION"],
  "auditoria.ver": ["ADMINISTRACION"],
};

/** Roles que pueden hacer una acción por unidad sobre CUALQUIER unidad. */
const SOBRE_CUALQUIER_UNIDAD: Partial<Record<Accion, Rol[]>> = {
  "liquidacion.verCuentaUnidad": ["ADMINISTRACION", "COMISION"],
  "reserva.crearParaUnidad": ["ADMINISTRACION", "PORTERIA"],
  "reserva.cancelarDeUnidad": ["ADMINISTRACION", "PORTERIA"],
  "datos.verUnidad": ["ADMINISTRACION"],
  "datos.editarPersona": ["ADMINISTRACION"],
  "datos.altaInquilino": ["ADMINISTRACION"],
  "datos.bajaInquilino": ["ADMINISTRACION"],
  "datos.gestionarDestinatarios": ["ADMINISTRACION"],
  "solicitud.verDeUnidad": ["ADMINISTRACION", "COMISION"],
};

const esDueno = (c: Calidad) => c === "PROPIETARIO" || c === "PROMITENTE";

/** Reglas para quien está vinculado a la unidad. */
function puedeComoVinculado(
  accion: Accion,
  vinculo: VinculoUnidad,
  recurso: Recurso,
): boolean {
  switch (accion) {
    case "liquidacion.verCuentaUnidad":
    case "reserva.crearParaUnidad":
    case "reserva.cancelarDeUnidad":
    case "datos.verUnidad":
    case "solicitud.crear":
    case "solicitud.verDeUnidad":
      return true;
    case "datos.editarPersona":
      // Cada uno edita sus propios datos; el dueño además puede editar al inquilino.
      return recurso.personaId === vinculo.personaId || esDueno(vinculo.calidad);
    case "datos.altaInquilino":
    case "datos.gestionarDestinatarios":
    case "datos.avisarVenta":
      return esDueno(vinculo.calidad);
    case "datos.bajaInquilino":
      // El dueño da de baja al inquilino; el inquilino puede darse de baja a sí mismo.
      return esDueno(vinculo.calidad) || recurso.personaId === vinculo.personaId;
    default:
      return false;
  }
}

export function puede(actor: Actor | null, accion: Accion, recurso: Recurso = {}): boolean {
  if (!actor) return false;

  const roles = POR_ROL[accion];
  if (roles) return roles.includes(actor.rol);

  // Acciones por unidad: requieren unidadId.
  if (!recurso.unidadId) return false;

  if (SOBRE_CUALQUIER_UNIDAD[accion]?.includes(actor.rol)) return true;

  const vinculo = actor.unidades.find((u) => u.unidadId === recurso.unidadId);
  if (!vinculo) return false;
  return puedeComoVinculado(accion, vinculo, recurso);
}

export class ErrorPermiso extends Error {
  constructor(public accion: Accion) {
    super(`No tenés permiso para esta acción (${accion}).`);
    this.name = "ErrorPermiso";
  }
}
