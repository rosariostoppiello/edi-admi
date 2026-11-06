/**
 * Resumen de egresos por rubro contable (secciones 1 y 6 del PDF modelo).
 * Rubros de dos niveles: "2 Personal tercerizado" → "2.1 Portería fija".
 */
import { centesimos, sumar, type Centesimos } from "../dinero";

export interface RubroBase {
  id: string;
  codigo: string;
  nombre: string;
  padreId: string | null;
  cargoPropietario: boolean;
  orden: number;
}

export interface EgresoBase {
  rubroId: string;
  monto: number;
}

export interface SubrubroResumen {
  rubro: RubroBase;
  total: Centesimos;
}

export interface RubroResumen {
  rubro: RubroBase;
  total: Centesimos;
  /** Porcentaje sobre el total de egresos, en puntos básicos (1234 = 12,34 %). */
  porcentajePb: number;
  subrubros: SubrubroResumen[];
}

export interface ResumenEgresos {
  rubros: RubroResumen[];
  total: Centesimos;
  /** Egresos de rubros de cargo de los propietarios (ej. seguro). */
  totalCargoPropietario: Centesimos;
}

/** Porcentaje entero en puntos básicos, redondeado hacia arriba en la mitad. */
export function porcentajePb(parte: number, total: number): number {
  if (total === 0) return 0;
  return Math.floor((parte * 20000 + total) / (2 * total));
}

/** "12,34 %" */
export function formatearPorcentaje(pb: number): string {
  const entero = Math.floor(Math.abs(pb) / 100);
  const dec = String(Math.abs(pb) % 100).padStart(2, "0");
  return `${pb < 0 ? "-" : ""}${entero},${dec} %`;
}

function compararCodigo(a: RubroBase, b: RubroBase) {
  if (a.orden !== b.orden) return a.orden - b.orden;
  return a.codigo.localeCompare(b.codigo, "es", { numeric: true });
}

export function resumirEgresos(rubros: RubroBase[], egresos: EgresoBase[]): ResumenEgresos {
  const porId = new Map(rubros.map((r) => [r.id, r]));
  const totalPorRubro = new Map<string, Centesimos>();
  for (const e of egresos) {
    if (!porId.has(e.rubroId)) throw new Error(`Egreso con rubro inexistente: ${e.rubroId}`);
    totalPorRubro.set(e.rubroId, sumar(totalPorRubro.get(e.rubroId) ?? centesimos(0), centesimos(e.monto)));
  }

  const raiz = (r: RubroBase): RubroBase => (r.padreId && porId.get(r.padreId) ? raiz(porId.get(r.padreId)!) : r);
  const grupos = new Map<string, { rubro: RubroBase; propio: Centesimos; subrubros: SubrubroResumen[] }>();
  for (const [rubroId, total] of totalPorRubro) {
    const r = porId.get(rubroId)!;
    const padre = raiz(r);
    const g = grupos.get(padre.id) ?? { rubro: padre, propio: centesimos(0), subrubros: [] };
    if (padre.id === r.id) g.propio = sumar(g.propio, total);
    else g.subrubros.push({ rubro: r, total });
    grupos.set(padre.id, g);
  }

  const total = sumar(...[...totalPorRubro.values()]);
  const lista = [...grupos.values()]
    .map((g) => {
      const t = sumar(g.propio, ...g.subrubros.map((s) => s.total));
      return {
        rubro: g.rubro,
        total: t,
        porcentajePb: porcentajePb(t, total),
        subrubros: g.subrubros.sort((a, b) => compararCodigo(a.rubro, b.rubro)),
      };
    })
    .sort((a, b) => compararCodigo(a.rubro, b.rubro));

  const esCargoPropietario = (rubroId: string) => {
    const r = porId.get(rubroId)!;
    return r.cargoPropietario || raiz(r).cargoPropietario;
  };
  const totalCargoPropietario = sumar(
    ...egresos.filter((e) => esCargoPropietario(e.rubroId)).map((e) => centesimos(e.monto)),
  );

  return { rubros: lista, total, totalCargoPropietario };
}
