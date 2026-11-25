/** Reglas del botón de emergencia (decisión 82). Lógica pura, sin DB. */

export const TIPOS_EMERGENCIA = ["GAS", "INCENDIO", "AGUA", "ASCENSOR", "SEGURIDAD", "OTRA"] as const;
export type TipoEmergencia = (typeof TIPOS_EMERGENCIA)[number];
export type EstadoEmergencia = "ACTIVA" | "ATENDIDA" | "FALSA_ALARMA";

export const NOMBRE_TIPO: Record<TipoEmergencia, string> = {
  GAS: "Olor a gas o fuga de gas",
  INCENDIO: "Incendio o humo",
  AGUA: "Pérdida de agua o inundación",
  ASCENSOR: "Persona atrapada en el ascensor",
  SEGURIDAD: "Problema de seguridad",
  OTRA: "Otra emergencia",
};

/** Nombre corto, para asuntos de mail y la alerta de Portería. */
export const CORTO_TIPO: Record<TipoEmergencia, string> = {
  GAS: "Gas",
  INCENDIO: "Incendio",
  AGUA: "Agua",
  ASCENSOR: "Ascensor",
  SEGURIDAD: "Seguridad",
  OTRA: "Emergencia",
};

export const NOMBRE_ESTADO: Record<EstadoEmergencia, string> = {
  ACTIVA: "Activa",
  ATENDIDA: "Atendida",
  FALSA_ALARMA: "Falsa alarma",
};

/** Qué conviene hacer mientras llega la ayuda, según el tipo. */
export const CONSEJO: Partial<Record<TipoEmergencia, string>> = {
  GAS: "No prendas luces ni uses el ascensor. Abrí las ventanas y salí del lugar.",
  INCENDIO: "Bajá por la escalera, nunca por el ascensor. Si hay humo, agachate.",
  AGUA: "Si podés, cerrá la llave de paso. No toques enchufes mojados.",
  ASCENSOR: "Quedate tranquilo adentro y no intentes abrir las puertas.",
};

/** Números de emergencia de Uruguay. */
export const NUMEROS_EMERGENCIA = [
  { nombre: "Emergencias", numero: "911" },
] as const;

/** Minutos que tiene que esperar una misma persona para mandar otro aviso. */
export const ESPERA_ENTRE_AVISOS_MIN = 5;

/** Minutos que faltan para poder avisar de nuevo (0 si ya puede). */
export function minutosParaAvisar(ultimoAviso: Date | null, ahora: Date = new Date()): number {
  if (!ultimoAviso) return 0;
  const transcurrido = (ahora.getTime() - ultimoAviso.getTime()) / 60_000;
  return transcurrido >= ESPERA_ENTRE_AVISOS_MIN ? 0 : Math.ceil(ESPERA_ENTRE_AVISOS_MIN - transcurrido);
}

/**
 * Primer número de teléfono de un texto libre ("2600 1234 / 099 123 456 (noche)"),
 * listo para un enlace tel:. Uruguay: fijos de 8 dígitos, celulares 09X de 9.
 */
export function primerTelefono(texto: string | null | undefined): string | null {
  if (!texto) return null;
  for (const trozo of texto.split(/[\/,;]|\by\b|\bo\b/)) {
    const digitos = trozo.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    const solo = digitos.replace(/^\+/, "");
    if (solo.length >= 3 && solo.length <= 15) return digitos;
  }
  return null;
}

/** Texto por defecto del aviso a todas las unidades (no dice quién avisó: Ley 18.331). */
export function mensajeGeneral(tipo: TipoEmergencia, lugar: string): string {
  const donde = lugar.trim() ? ` en ${lugar.trim()}` : " en el edificio";
  const base = `Aviso de emergencia: ${NOMBRE_TIPO[tipo].toLowerCase()}${donde}.`;
  const consejo = CONSEJO[tipo];
  return consejo ? `${base} ${consejo} Seguí las indicaciones de Portería.` : `${base} Seguí las indicaciones de Portería.`;
}
