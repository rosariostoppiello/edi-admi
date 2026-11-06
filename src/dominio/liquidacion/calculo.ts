/**
 * Cálculo de la liquidación mensual por línea (unidad + sufijo A/P/I).
 * Lógica pura: no toca la base ni Next. Montos en centésimos enteros.
 *
 * Reglas (verificadas contra el PDF modelo, docs/PLAN.md §1 y §7):
 * - Saldo = Saldo anterior − Pagos
 * - Intereses = 1 % × Saldo, al peso, solo si el saldo es positivo (tasa configurable)
 * - FR = 5 % × (GC unidad + GC garaje) de la unidad completa, al peso (tasa configurable).
 *   Lo paga el responsable (A o P).
 * - Saldo a pagar = Saldo + Intereses y otros + GC unidad + GC garaje + FR + Tag
 *   + Barbacoa/Otros + Multas
 * - Unidad sin alquilar (A): paga todo.
 * - Unidad alquilada: I paga el GC ordinario; P paga la parte de cargo del
 *   propietario y el FR; el garaje lo paga quien diga la unidad.
 * - Si la unidad cambió A ↔ P+I desde el mes anterior, los saldos, pagos y
 *   cargos que vengan con un sufijo que ya no existe se reasignan
 *   (ver `sufijoVigente`).
 */
import { centesimos, porcentajeAlPeso, sumar, type Centesimos } from "../dinero";
import { formatearCodigo, sufijosDeUnidad, type Sufijo } from "../codigos";

export type ACargoDe = "PROPIETARIO" | "INQUILINO";
export type TipoCargo = "INTERES_OTRO" | "TAG" | "BARBACOA_OTROS" | "MULTA";

export interface UnidadALiquidar {
  unidadId: string;
  torre: number;
  torreNombre: string;
  torreOrden: number;
  numero: string;
  etiqueta?: string | null;
  arrendada: boolean;
  gcUnidad: number;
  gcPropietario: number;
  gcGaraje: number;
  garajeACargoDe: ACargoDe;
}

export interface MontoDeLinea {
  unidadId: string;
  sufijo: Sufijo;
  monto: number;
}

export interface CargoDeLinea extends MontoDeLinea {
  tipo: TipoCargo;
}

export interface EntradaLiquidacion {
  unidades: UnidadALiquidar[];
  /** Saldo a pagar del mes anterior (o saldo inicial), por línea. */
  saldosAnteriores: MontoDeLinea[];
  pagos: MontoDeLinea[];
  cargos: CargoDeLinea[];
  tasaInteresPb: number;
  tasaFondoReservaPb: number;
}

export interface Linea {
  unidadId: string;
  sufijo: Sufijo;
  codigo: string;
  descripcion: string;
  orden: number;
  saldoAnterior: Centesimos;
  pagos: Centesimos;
  saldo: Centesimos;
  intereses: Centesimos;
  gcUnidad: Centesimos;
  gcGaraje: Centesimos;
  fondoReserva: Centesimos;
  tag: Centesimos;
  barbacoaOtros: Centesimos;
  multas: Centesimos;
  saldoAPagar: Centesimos;
}

export const COLUMNAS_MONTO = [
  "saldoAnterior",
  "pagos",
  "saldo",
  "intereses",
  "gcUnidad",
  "gcGaraje",
  "fondoReserva",
  "tag",
  "barbacoaOtros",
  "multas",
  "saldoAPagar",
] as const;

export type ColumnaMonto = (typeof COLUMNAS_MONTO)[number];
export type Totales = Record<ColumnaMonto, Centesimos>;

export interface ResultadoLiquidacion {
  lineas: Linea[];
  totales: Totales;
  /** Montos que no se pudieron ubicar (unidad que ya no está activa). */
  sinUbicar: (MontoDeLinea & { origen: "saldo" | "pago" | "cargo" })[];
}

/**
 * Sufijo vigente para un monto que viene con `sufijo`, según cómo está hoy la unidad.
 * - Unidad sin alquilar: P e I pasan a A (el propietario responde por la deuda
 *   de gastos comunes de la unidad).
 * - Unidad alquilada: A pasa a P (el saldo queda en el propietario; el
 *   inquilino nuevo arranca en cero).
 */
export function sufijoVigente(sufijo: Sufijo, arrendada: boolean): Sufijo {
  if (arrendada) return sufijo === "A" ? "P" : sufijo;
  return "A";
}

/** Texto de la columna "Id." del PDF: "AVENUE 201 (P)", o la etiqueta de la unidad. */
export function descripcionLinea(u: Pick<UnidadALiquidar, "torreNombre" | "numero" | "etiqueta">, sufijo: Sufijo): string {
  const base = u.etiqueta?.trim() || `${u.torreNombre.toUpperCase()} ${u.numero}`;
  return sufijo === "A" ? base : `${base} (${sufijo})`;
}

const ORDEN_SUFIJO: Record<Sufijo, number> = { A: 0, P: 1, I: 2 };

function compararUnidades(a: UnidadALiquidar, b: UnidadALiquidar): number {
  if (a.torreOrden !== b.torreOrden) return a.torreOrden - b.torreOrden;
  if (a.torre !== b.torre) return a.torre - b.torre;
  // Números como texto pero ordenados de forma natural ("001" < "101" < "1002").
  return a.numero.localeCompare(b.numero, "es", { numeric: true });
}

/** Reparte las cuotas fijas de la unidad entre sus líneas. */
export function cuotasPorLinea(u: UnidadALiquidar, tasaFondoReservaPb: number) {
  const gcTotal = centesimos(u.gcUnidad + u.gcPropietario);
  const fr = porcentajeAlPeso(centesimos(gcTotal + u.gcGaraje), tasaFondoReservaPb);
  const cero = centesimos(0);
  if (!u.arrendada) {
    return { A: { gcUnidad: gcTotal, gcGaraje: centesimos(u.gcGaraje), fondoReserva: fr } };
  }
  const garajeP = u.garajeACargoDe === "PROPIETARIO";
  return {
    P: { gcUnidad: centesimos(u.gcPropietario), gcGaraje: garajeP ? centesimos(u.gcGaraje) : cero, fondoReserva: fr },
    I: { gcUnidad: centesimos(u.gcUnidad), gcGaraje: garajeP ? cero : centesimos(u.gcGaraje), fondoReserva: cero },
  } as Partial<Record<Sufijo, { gcUnidad: Centesimos; gcGaraje: Centesimos; fondoReserva: Centesimos }>>;
}

export function calcularLiquidacion(e: EntradaLiquidacion): ResultadoLiquidacion {
  const unidades = [...e.unidades].sort(compararUnidades);
  const porId = new Map(unidades.map((u) => [u.unidadId, u]));
  const clave = (unidadId: string, sufijo: Sufijo) => `${unidadId}|${sufijo}`;
  const sinUbicar: ResultadoLiquidacion["sinUbicar"] = [];

  const acumular = (lista: MontoDeLinea[], origen: "saldo" | "pago" | "cargo", destino: Map<string, number>) => {
    for (const m of lista) {
      const u = porId.get(m.unidadId);
      if (!u) {
        if (m.monto !== 0) sinUbicar.push({ ...m, origen });
        continue;
      }
      const k = clave(m.unidadId, sufijoVigente(m.sufijo, u.arrendada));
      destino.set(k, sumar(centesimos(destino.get(k) ?? 0), centesimos(m.monto)));
    }
  };

  const saldos = new Map<string, number>();
  const pagos = new Map<string, number>();
  acumular(e.saldosAnteriores, "saldo", saldos);
  acumular(e.pagos, "pago", pagos);
  const cargos: Record<TipoCargo, Map<string, number>> = {
    INTERES_OTRO: new Map(),
    TAG: new Map(),
    BARBACOA_OTROS: new Map(),
    MULTA: new Map(),
  };
  for (const tipo of Object.keys(cargos) as TipoCargo[]) {
    acumular(
      e.cargos.filter((c) => c.tipo === tipo),
      "cargo",
      cargos[tipo],
    );
  }

  const lineas: Linea[] = [];
  let orden = 0;
  for (const u of unidades) {
    const cuotas = cuotasPorLinea(u, e.tasaFondoReservaPb);
    for (const sufijo of sufijosDeUnidad(u.arrendada).sort((a, b) => ORDEN_SUFIJO[a] - ORDEN_SUFIJO[b])) {
      const k = clave(u.unidadId, sufijo);
      const c = cuotas[sufijo]!;
      const saldoAnterior = centesimos(saldos.get(k) ?? 0);
      const pagado = centesimos(pagos.get(k) ?? 0);
      const saldo = centesimos(saldoAnterior - pagado);
      const interes = saldo > 0 ? porcentajeAlPeso(saldo, e.tasaInteresPb) : centesimos(0);
      const intereses = sumar(interes, centesimos(cargos.INTERES_OTRO.get(k) ?? 0));
      const tag = centesimos(cargos.TAG.get(k) ?? 0);
      const barbacoaOtros = centesimos(cargos.BARBACOA_OTROS.get(k) ?? 0);
      const multas = centesimos(cargos.MULTA.get(k) ?? 0);
      lineas.push({
        unidadId: u.unidadId,
        sufijo,
        codigo: formatearCodigo({ torre: u.torre, numero: u.numero, sufijo }),
        descripcion: descripcionLinea(u, sufijo),
        orden: orden++,
        saldoAnterior,
        pagos: pagado,
        saldo,
        intereses,
        gcUnidad: c.gcUnidad,
        gcGaraje: c.gcGaraje,
        fondoReserva: c.fondoReserva,
        tag,
        barbacoaOtros,
        multas,
        saldoAPagar: sumar(saldo, intereses, c.gcUnidad, c.gcGaraje, c.fondoReserva, tag, barbacoaOtros, multas),
      });
    }
  }

  return { lineas, totales: totalizar(lineas), sinUbicar };
}

export function totalizar(lineas: Pick<Linea, ColumnaMonto>[]): Totales {
  const t = Object.fromEntries(COLUMNAS_MONTO.map((c) => [c, centesimos(0)])) as Totales;
  for (const l of lineas) for (const c of COLUMNAS_MONTO) t[c] = sumar(t[c], centesimos(l[c]));
  return t;
}
