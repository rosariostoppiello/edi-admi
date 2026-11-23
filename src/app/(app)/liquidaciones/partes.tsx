import type { ReactNode } from "react";
import { Placa } from "@/componentes/ui/placa";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { Monto } from "@/componentes/ui/monto";
import { COLUMNAS_MONTO, GRUPOS_COLUMNAS, TITULOS_COLUMNAS, type ColumnaMonto, type Linea, type Totales } from "@/dominio/liquidacion/calculo";
import { formatearPorcentaje, type ResumenEgresos } from "@/dominio/liquidacion/egresos";
import { formatearFecha } from "@/dominio/liquidacion/periodo";

export function Seccion({ titulo, children, accion }: { titulo: string; children: ReactNode; accion?: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-titulo font-bold">{titulo}</h2>
        {accion}
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {/* Los avisos de éxito quedan acá aunque el formulario que los generó desaparezca. */}
        <ZonaAvisos>{children}</ZonaAvisos>
      </div>
    </section>
  );
}

const ESTADOS = {
  BORRADOR: { texto: "Borrador", clase: "border-junta-fuerte bg-granito text-pizarra" },
  PUBLICADA: { texto: "Publicada", clase: "border-ok bg-ok-fondo text-ok" },
  ANULADA: { texto: "Anulada", clase: "border-alerta bg-alerta-fondo text-alerta" },
} as const;

export function Estado({ estado }: { estado: keyof typeof ESTADOS }) {
  const e = ESTADOS[estado];
  return <span className={`inline-block rounded-full border px-3 py-0.5 text-chico font-bold ${e.clase}`}>{e.texto}</span>;
}

type LineaRecibo = Record<ColumnaMonto, number> & { codigo: string };

/**
 * El recibo de una línea: la placa con el saldo a pagar y la cuenta hecha,
 * renglón por renglón, como en una libreta.
 */
export function Recibo({ linea, vence }: { linea: LineaRecibo; vence: string }) {
  const aFavor = linea.saldoAPagar < 0;
  const cargos: [string, number][] = [
    ["Intereses", linea.intereses],
    ["Gasto común", linea.gcUnidad],
    ["Garaje", linea.gcGaraje],
    ["Fondo de reserva", linea.fondoReserva],
    ["Cuota extra del fondo de reserva", linea.cuotaExtraFr],
    ["Barbacoas", linea.barbacoas],
    ["Otros", linea.otros],
    ["Multas", linea.multas],
  ];
  return (
    <article className="overflow-hidden rounded-[var(--radius-tecla)] border border-junta border-b-4 border-b-junta-fuerte bg-losa" aria-label={`Cuenta de ${linea.codigo}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-junta p-4 md:p-6">
        <Placa codigo={linea.codigo} tamano="grande" />
        <div className="sm:text-right">
          <p className="text-pizarra-suave">{aFavor ? "Saldo a favor" : "Total a pagar"}</p>
          <p className={`text-enorme font-bold leading-none ${aFavor ? "text-ok" : ""}`}>
            <Monto valor={aFavor ? -linea.saldoAPagar : linea.saldoAPagar} conSimbolo />
          </p>
          {!aFavor && linea.saldoAPagar > 0 && <p className="mt-1 font-bold">Vence el {formatearFecha(vence)}</p>}
        </div>
      </div>
      <dl className="flex flex-col p-4 md:px-6">
        <Renglon etiqueta="Saldo del mes anterior" valor={linea.saldoAnterior} />
        <Renglon etiqueta="Pagos recibidos" valor={-linea.pagos} />
        <Renglon etiqueta="Saldo" valor={linea.saldo} subtotal />
        {cargos
          .filter(([, v]) => v !== 0)
          .map(([etiqueta, v]) => (
            <Renglon key={etiqueta} etiqueta={etiqueta} valor={v} />
          ))}
        <Renglon etiqueta={aFavor ? "Saldo a favor" : "Total a pagar"} valor={linea.saldoAPagar} total />
      </dl>
    </article>
  );
}

function Renglon({ etiqueta, valor, subtotal, total }: { etiqueta: string; valor: number; subtotal?: boolean; total?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${subtotal ? "border-t border-junta-fuerte font-bold" : ""} ${
        total ? "mt-1 border-t-[3px] border-double border-pizarra pt-2 text-medio font-bold" : ""
      }`}
    >
      <dt>{etiqueta}</dt>
      <dd>
        <Monto valor={valor} />
      </dd>
    </div>
  );
}


/**
 * Tabla consolidada (todas las líneas). El código queda fijo a la izquierda y el
 * scroll horizontal es de la tabla, no de la página.
 */
export function TablaLineas({ lineas, totales, titulo }: { lineas: Linea[]; totales: Totales; titulo: string }) {
  return (
    <div className="max-h-[70vh] overflow-auto rounded-[var(--radius-campo)] border border-junta" tabIndex={0} role="region" aria-label={titulo}>
      <table className="w-full border-separate border-spacing-0 text-chico tabular-nums">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          {/* Dos niveles: "Estado de cuenta" y "Cargos del mes" (decisión 35). Alto fijo por fila para el sticky. */}
          <tr>
            <th rowSpan={2} scope="col" className="sticky left-0 top-0 z-30 border-b-2 border-pizarra bg-granito px-3 py-2 text-left align-bottom">
              Unidad
            </th>
            {GRUPOS_COLUMNAS.map((g) => (
              <th
                key={g.titulo}
                colSpan={g.columnas.length}
                scope="colgroup"
                className="sticky top-0 z-10 h-9 border-b border-l border-junta-fuerte bg-granito px-3 text-left whitespace-nowrap"
              >
                {g.titulo}
              </th>
            ))}
            <th rowSpan={2} scope="col" className="sticky top-0 z-10 border-b-2 border-l border-pizarra border-l-junta-fuerte bg-granito px-3 py-2 text-right align-bottom whitespace-nowrap">
              {TITULOS_COLUMNAS.saldoAPagar}
            </th>
          </tr>
          <tr>
            {GRUPOS_COLUMNAS.flatMap((g) =>
              g.columnas.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`sticky top-9 z-10 border-b-2 border-pizarra bg-granito px-3 py-2 text-right whitespace-nowrap ${i === 0 ? "border-l border-l-junta-fuerte" : ""}`}
                >
                  {TITULOS_COLUMNAS[c]}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={`${l.unidadId}-${l.sufijo}`} className="group">
              <th scope="row" className="sticky left-0 z-10 border-b border-junta bg-losa px-3 py-1.5 text-left font-mono font-bold whitespace-nowrap group-hover:bg-granito">
                {l.codigo}
              </th>
              {COLUMNAS_MONTO.map((c) => (
                <td key={c} className={`border-b border-junta px-3 py-1.5 text-right group-hover:bg-granito ${c === "saldoAPagar" ? "font-bold" : ""}`}>
                  <Monto valor={l[c]} vacioSiCero={c !== "saldoAPagar"} className={l[c] < 0 ? "text-ok" : ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <th scope="row" className="sticky bottom-0 left-0 z-20 border-t-2 border-pizarra bg-granito px-3 py-2 text-left">
              Totales
            </th>
            {COLUMNAS_MONTO.map((c) => (
              <td key={c} className="sticky bottom-0 z-10 border-t-2 border-pizarra bg-granito px-3 py-2 text-right">
                <Monto valor={totales[c]} />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function TablaResumenEgresos({ resumen }: { resumen: ResumenEgresos }) {
  if (resumen.rubros.length === 0) return <p className="text-pizarra-suave">No hay egresos cargados.</p>;
  return (
    <table className="w-full text-left tabular-nums">
      <caption className="sr-only">Egresos del mes por rubro</caption>
      <thead>
        <tr className="border-b-2 border-pizarra">
          <th scope="col" className="py-2">Rubro</th>
          <th scope="col" className="py-2 text-right">Monto</th>
          <th scope="col" className="hidden py-2 pl-4 text-right sm:table-cell">%</th>
        </tr>
      </thead>
      <tbody>
        {resumen.rubros.map((g) => (
          <RubroFilas key={g.rubro.id} g={g} />
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-pizarra font-bold">
          <th scope="row" className="py-2">Total egresos</th>
          <td className="py-2 text-right"><Monto valor={resumen.total} /></td>
          <td className="hidden sm:table-cell" />
        </tr>
      </tfoot>
    </table>
  );
}

function RubroFilas({ g }: { g: ResumenEgresos["rubros"][number] }) {
  return (
    <>
      <tr className="border-b border-junta font-bold">
        <th scope="row" className="py-2 pr-2">
          {g.rubro.codigo} {g.rubro.nombre}
          <span className="ml-2 font-normal text-pizarra-suave sm:hidden">({formatearPorcentaje(g.porcentajePb)})</span>
        </th>
        <td className="py-2 text-right"><Monto valor={g.total} /></td>
        <td className="hidden py-2 pl-4 text-right font-normal text-pizarra-suave sm:table-cell">{formatearPorcentaje(g.porcentajePb)}</td>
      </tr>
      {g.subrubros.map((s) => (
        <tr key={s.rubro.id} className="border-b border-junta">
          <th scope="row" className="py-1.5 pl-4 pr-2 font-normal">{s.rubro.codigo} {s.rubro.nombre}</th>
          <td className="py-1.5 text-right"><Monto valor={s.total} /></td>
          <td className="hidden sm:table-cell" />
        </tr>
      ))}
    </>
  );
}

export function EnlacePdf({ id, texto = "Descargar PDF", detalle }: { id: string; texto?: string; detalle?: string }) {
  return (
    <a
      href={`/api/liquidaciones/${id}/pdf`}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-campo)] border-2 border-pizarra bg-losa px-5 font-bold text-pizarra hover:bg-granito"
    >
      {texto}
      <span className="sr-only">
        {detalle ? ` ${detalle}` : ""} (se abre en otra pestaña)
      </span>
    </a>
  );
}
