import { Aviso } from "@/componentes/ui/aviso";
import { Monto } from "@/componentes/ui/monto";
import { formatearFecha } from "@/dominio/liquidacion/periodo";
import type { importacionPendiente, TipoPlanilla } from "@/servidor/liquidacion/importar";
import { accionConfirmarImportacion, accionDescartarImportacion } from "../acciones";
import { BotonAccion } from "./formularios";

/** Vista previa de una planilla subida (ingresos, saldos iniciales o egresos), antes de confirmarla. */
export function VistaPrevia({
  liquidacionId,
  imp,
  tipo,
}: {
  liquidacionId: string;
  imp: NonNullable<Awaited<ReturnType<typeof importacionPendiente>>>;
  tipo: TipoPlanilla;
}) {
  const conAvisos = imp.filas.filter((f) => f.avisos.length > 0).length;
  const egresos = tipo === "EGRESOS";
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-granito p-4">
      <p className="font-bold">
        Vista previa de “{imp.archivoNombre}”: {imp.filas.length} filas
        {tipo !== "SALDOS_INICIALES" && imp.errores === 0 && (
          <>
            {" "}por <Monto valor={imp.total} conSimbolo />
          </>
        )}
        .
      </p>
      {imp.errores > 0 ? (
        <Aviso tono="error">
          {imp.errores === 1 ? "Hay 1 fila con errores" : `Hay ${imp.errores} filas con errores`}. Corregí la planilla y subila de nuevo: no se
          carga nada hasta que esté todo bien.
        </Aviso>
      ) : (
        <Aviso tono="ok">
          Todas las filas están bien{conAvisos ? `; revisá los ${conAvisos} avisos antes de confirmar` : ""}.
        </Aviso>
      )}
      <div className="max-h-96 overflow-auto rounded-[var(--radius-campo)] border border-junta bg-losa" tabIndex={0} role="region" aria-label="Filas de la planilla">
        <table className="w-full text-chico tabular-nums">
          <thead className="sticky top-0 bg-granito">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">Fila</th>
              <th scope="col" className="px-3 py-2 text-left">{egresos ? "Rubro" : "Unidad"}</th>
              {tipo !== "SALDOS_INICIALES" && <th scope="col" className="px-3 py-2 text-left">Fecha</th>}
              {egresos && <th scope="col" className="px-3 py-2 text-left">Proveedor</th>}
              {egresos && <th scope="col" className="px-3 py-2 text-left">Período</th>}
              <th scope="col" className="px-3 py-2 text-right">{tipo === "SALDOS_INICIALES" ? "Saldo" : "Monto"}</th>
              <th scope="col" className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {imp.filas.map((f) => (
              <tr key={f.fila} className={`border-t border-junta ${f.errores.length ? "bg-alerta-fondo" : ""}`}>
                <td className="px-3 py-1.5">{f.fila}</td>
                <td className="px-3 py-1.5 font-bold whitespace-nowrap">
                  <span className="font-mono">{f.codigo || "—"}</span>
                  {f.rubroNombre && <span className="font-normal"> {f.rubroNombre}</span>}
                </td>
                {tipo !== "SALDOS_INICIALES" && <td className="px-3 py-1.5 whitespace-nowrap">{f.fecha ? formatearFecha(f.fecha) : "—"}</td>}
                {egresos && <td className="px-3 py-1.5">{f.proveedor || "—"}</td>}
                {egresos && <td className="px-3 py-1.5">{f.detalle || "—"}</td>}
                <td className="px-3 py-1.5 text-right">{f.monto !== null ? <Monto valor={f.monto} /> : "—"}</td>
                <td className="px-3 py-1.5">
                  {f.errores.length > 0 ? (
                    <span className="font-bold text-alerta">{f.errores.join(" ")}</span>
                  ) : f.avisos.length > 0 ? (
                    <span>{f.avisos.join(" ")}</span>
                  ) : (
                    <span className="text-ok">Bien</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        {imp.errores === 0 && (
          <BotonAccion
            accion={accionConfirmarImportacion.bind(null, liquidacionId, imp.id)}
            texto={
              tipo === "SALDOS_INICIALES"
                ? "Cargar los saldos"
                : `Cargar ${imp.filas.length} ${egresos ? (imp.filas.length === 1 ? "egreso" : "egresos") : imp.filas.length === 1 ? "pago" : "pagos"}`
            }
          />
        )}
        <BotonAccion accion={accionDescartarImportacion.bind(null, liquidacionId, imp.id)} texto="Descartar planilla" variante="secundario" />
      </div>
    </div>
  );
}
