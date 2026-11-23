/**
 * Reglas de reserva de espacios comunes (docs/PLAN.md, decisiones 15 y 45 a 52).
 * Lógica pura: las fechas son texto "AAAA-MM-DD" (día de calendario en Uruguay)
 * y los instantes se calculan con la hora de Uruguay (UTC−3, sin horario de verano).
 */
import { z } from "zod";
import type { Sufijo } from "./codigos";

export type Turno = "MEDIODIA" | "NOCHE";
export const TURNOS: Turno[] = ["MEDIODIA", "NOCHE"];

export const DATOS_TURNO: Record<Turno, { nombre: string; horario: string; inicio: number; fin: number }> = {
  MEDIODIA: { nombre: "Mediodía", horario: "11 a 17 h", inicio: 11, fin: 17 },
  // La noche termina a las 2 del día siguiente (hora 26 del día reservado).
  NOCHE: { nombre: "Noche", horario: "19 a 2 h", inicio: 19, fin: 26 },
};

const OFFSET_UY_HORAS = -3;
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const REGEX_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function esFecha(texto: string): boolean {
  const m = REGEX_FECHA.exec(texto);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === texto;
}

/** Instante en que es `hora` (puede pasar de 24) del día `fecha` en Uruguay. */
export function instanteUy(fecha: string, hora: number): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) + (hora - OFFSET_UY_HORAS) * HORA);
}

export const inicioTurno = (fecha: string, turno: Turno) => instanteUy(fecha, DATOS_TURNO[turno].inicio);
export const finTurno = (fecha: string, turno: Turno) => instanteUy(fecha, DATOS_TURNO[turno].fin);

/** Día de calendario en Uruguay de un instante. */
export function fechaUy(instante: Date): string {
  return new Date(instante.getTime() + OFFSET_UY_HORAS * HORA).toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d) + dias * DIA).toISOString().slice(0, 10);
}

/** Lunes de la semana de `fecha`. */
export function lunesDe(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

export function diasDesde(desde: string, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => sumarDias(desde, i));
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre"];

/** "sábado 12 de setiembre" */
export function fechaEnFrase(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`;
}

/** "12/09" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Reglas por espacio (JSON validado con Zod)
// ---------------------------------------------------------------------------

export const reglasSchema = z.object({
  anticipacionDias: z.int("Escribí un número entero de días.").min(1, "Tiene que ser al menos 1 día.").max(365, "Como máximo 365 días."),
  maxActivasPorUnidad: z.int("Escribí un número entero.").min(1, "Tiene que ser al menos 1.").max(10, "Como máximo 10."),
  horasCancelacion: z.int("Escribí un número entero de horas.").min(0, "No puede ser negativo.").max(240, "Como máximo 240 horas."),
});

export type Reglas = z.infer<typeof reglasSchema>;

/** Decisión 15: hasta 60 días de anticipación, 2 reservas activas por unidad, cancelar hasta 48 h antes. */
export const REGLAS_POR_DEFECTO: Reglas = { anticipacionDias: 60, maxActivasPorUnidad: 2, horasCancelacion: 48 };

/** Lee las reglas guardadas; si faltan o están mal, usa las de por defecto. */
export function leerReglas(json: unknown): Reglas {
  const r = reglasSchema.partial().safeParse(json ?? {});
  return { ...REGLAS_POR_DEFECTO, ...(r.success ? r.data : {}) };
}

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

export interface PedidoReserva {
  fecha: string;
  turno: Turno;
  ahora: Date;
  reglas: Reglas;
  /** Reservas ACTIVAS de la unidad que todavía no terminaron (en cualquier barbacoa). */
  activasDeLaUnidad: number;
}

/** Devuelve el motivo por el que no se puede reservar, o null si se puede. */
export function motivoParaNoReservar({ fecha, turno, ahora, reglas, activasDeLaUnidad }: PedidoReserva): string | null {
  if (!esFecha(fecha)) return "Elegí una fecha válida.";
  if (inicioTurno(fecha, turno) <= ahora) return "Ese turno ya empezó o ya pasó.";
  const limite = sumarDias(fechaUy(ahora), reglas.anticipacionDias);
  if (fecha > limite) return `Se puede reservar hasta con ${reglas.anticipacionDias} días de anticipación.`;
  if (activasDeLaUnidad >= reglas.maxActivasPorUnidad) {
    return reglas.maxActivasPorUnidad === 1
      ? "La unidad ya tiene una reserva activa: es el máximo. Cuando pase o la canceles, podés hacer otra."
      : `La unidad ya tiene ${activasDeLaUnidad} reservas activas: es el máximo. Cuando pase alguna o la canceles, podés hacer otra.`;
  }
  return null;
}

/** Último instante en que la unidad (o Portería) puede cancelar: N horas antes del inicio del turno. */
export function limiteCancelacion(fecha: string, turno: Turno, reglas: Reglas): Date {
  return new Date(inicioTurno(fecha, turno).getTime() - reglas.horasCancelacion * HORA);
}

export function puedeCancelarEnPlazo(fecha: string, turno: Turno, ahora: Date, reglas: Reglas): boolean {
  return ahora <= limiteCancelacion(fecha, turno, reglas);
}

/** Una reserva activa cuenta para el máximo hasta que termina su turno. */
export function sigueVigente(fecha: string, turno: Turno, ahora: Date): boolean {
  return finTurno(fecha, turno) > ahora;
}

/**
 * Línea de la liquidación a la que se cobra: la de quien reservó, ajustada a la
 * situación actual de la unidad (si dejó de estar alquilada, todo va a A; si se
 * alquiló después de reservar como A, va a P).
 */
export function sufijoParaCobrar(sufijoReserva: Sufijo, arrendada: boolean): Sufijo {
  if (!arrendada) return "A";
  return sufijoReserva === "I" ? "I" : "P";
}

/** El solarium está disponible si su barbacoa no tiene reserva activa en ese turno. */
export function solariumDisponible(reservasDeSuBarbacoa: { fecha: string; turno: Turno }[], fecha: string, turno: Turno): boolean {
  return !reservasDeSuBarbacoa.some((r) => r.fecha === fecha && r.turno === turno);
}
