/**
 * Períodos de liquidación: texto "AAAA-MM". Las fechas se manejan como texto
 * "AAAA-MM-DD" (fechas de calendario, sin hora ni zona horaria).
 */

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
];

const REGEX_PERIODO = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function esPeriodo(texto: string): boolean {
  return REGEX_PERIODO.test(texto);
}

function partes(periodo: string): [number, number] {
  const m = REGEX_PERIODO.exec(periodo);
  if (!m) throw new Error(`Período inválido: "${periodo}"`);
  return [Number(m[1]), Number(m[2])];
}

export function periodoDe(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export function siguientePeriodo(periodo: string): string {
  const [a, m] = partes(periodo);
  return m === 12 ? periodoDe(a + 1, 1) : periodoDe(a, m + 1);
}

export function periodoAnterior(periodo: string): string {
  const [a, m] = partes(periodo);
  return m === 1 ? periodoDe(a - 1, 12) : periodoDe(a, m - 1);
}

/** "Octubre 2026" */
export function nombrePeriodo(periodo: string): string {
  const [a, m] = partes(periodo);
  return `${MESES[m - 1]} ${a}`;
}

/** "octubre" (para frases: "tu liquidación de octubre") */
export function nombreMes(periodo: string): string {
  return MESES[partes(periodo)[1] - 1].toLowerCase();
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** Primer y último día del período, "AAAA-MM-DD". */
export function rangoPeriodo(periodo: string): { desde: string; hasta: string } {
  const [a, m] = partes(periodo);
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(diasDelMes(a, m)).padStart(2, "0")}` };
}

/** Vencimiento del pago: el día indicado del mes SIGUIENTE al período. */
export function vencimiento(periodo: string, dia: number): string {
  const sig = siguientePeriodo(periodo);
  const [a, m] = partes(sig);
  return `${sig}-${String(Math.min(dia, diasDelMes(a, m))).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → "dd/mm/aaaa" */
export function formatearFecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Date (columna @db.Date, llega a medianoche UTC) → "AAAA-MM-DD". */
export function fechaIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * Lee una fecha escrita por una persona: "dd/mm/aaaa", "d/m/aa" o "AAAA-MM-DD".
 * Devuelve "AAAA-MM-DD" o null si no es una fecha válida.
 */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  let a: number, m: number, d: number;
  let r = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (r) {
    [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  } else {
    r = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
    if (!r) return null;
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (a < 100) a += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > diasDelMes(a, m)) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** ¿La fecha "AAAA-MM-DD" cae dentro del período? */
export function enPeriodo(fecha: string, periodo: string): boolean {
  return fecha.slice(0, 7) === periodo;
}

/** "octubre 2026", para usar dentro de una frase ("la liquidación de octubre 2026"). */
export function periodoEnFrase(periodo: string): string {
  return nombrePeriodo(periodo).toLowerCase();
}
