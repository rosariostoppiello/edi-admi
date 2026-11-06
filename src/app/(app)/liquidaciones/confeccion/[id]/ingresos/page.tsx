import type { Metadata } from "next";
import { Aviso } from "@/componentes/ui/aviso";
import { Monto } from "@/componentes/ui/monto";
import { formatearCodigo } from "@/dominio/codigos";
import { fechaIso, formatearFecha, rangoPeriodo } from "@/dominio/liquidacion/periodo";
import { codigosVigentes, listarDepositos, listarIngresos, obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { importacionPendiente, resumenSaldosIniciales } from "@/servidor/liquidacion/importar";
import {
  accionAgregarIngreso,
  accionCargarDeposito,
  accionConfirmarImportacion,
  accionDescartarImportacion,
  accionEliminarDeposito,
  accionEliminarIngreso,
  accionIdentificarDeposito,
  accionSubirPlanilla,
} from "../../../acciones";
import { Seccion } from "../../../partes";
import { BotonAccion, BotonQuitar, FormDeposito, FormIdentificar, FormIngreso, FormPlanilla } from "../../formularios";

export const metadata: Metadata = { title: "Ingresos de la liquidación" };

const ORIGEN = { MANUAL: "Carga manual", EXCEL: "Planilla", DEPOSITO: "Depósito identificado" } as const;

export default async function PaginaIngresos({ params }: PageProps<"/liquidaciones/confeccion/[id]/ingresos">) {
  const { id } = await params;
  const liq = (await obtenerBorrador(id))!;
  const [ingresos, codigos, pendiente, depositos] = await Promise.all([
    listarIngresos(id),
    codigosVigentes(),
    importacionPendiente(id, "INGRESOS"),
    listarDepositos(id),
  ]);
  const saldos = liq.primera ? await resumenSaldosIniciales(id) : null;
  const pendienteSaldos = liq.primera ? await importacionPendiente(id, "SALDOS_INICIALES") : null;
  const total = ingresos.reduce((s, i) => s + i.monto, 0);
  const hoy = new Date().toISOString().slice(0, 10);
  const { desde, hasta } = rangoPeriodo(liq.periodo);
  const fechaSugerida = hoy >= desde && hoy <= hasta ? hoy : desde;
  const sinIdentificar = depositos.filter((d) => !d.ingresoId);
  const identificados = depositos.filter((d) => d.ingresoId);

  return (
    <>
      {saldos && (
        <Seccion titulo="Saldos anteriores (primera liquidación)">
          <p className="max-w-prose text-pizarra-suave">
            Subí una planilla con dos columnas: <strong>Unidad</strong> (ej. 2-201-A) y <strong>Saldo</strong> (lo que debía cada línea
            antes de este mes; negativo si tenía saldo a favor). Si la subís de nuevo, reemplaza a la anterior.
          </p>
          {saldos.cantidad > 0 ? (
            <Aviso tono="ok">
              Hay saldos cargados para {saldos.cantidad} líneas, por un total de <Monto valor={saldos.total} conSimbolo />.
            </Aviso>
          ) : (
            <Aviso tono="info">Todavía no cargaste los saldos anteriores: sin ellos, todas las unidades arrancan en cero.</Aviso>
          )}
          {pendienteSaldos ? (
            <VistaPrevia liquidacionId={id} imp={pendienteSaldos} tipo="SALDOS_INICIALES" />
          ) : (
            <FormPlanilla accion={accionSubirPlanilla.bind(null, id, "SALDOS_INICIALES")} texto="Ver vista previa" />
          )}
        </Seccion>
      )}

      <Seccion titulo="Importar pagos desde una planilla">
        <p className="max-w-prose text-pizarra-suave">
          La planilla tiene que tener una fila de encabezados con <strong>Fecha</strong>, <strong>Unidad</strong> y <strong>Monto</strong>{" "}
          (y opcionalmente <strong>Referencia</strong>). Antes de cargar nada te mostramos cada fila con sus errores.
        </p>
        {pendiente ? (
          <VistaPrevia liquidacionId={id} imp={pendiente} tipo="INGRESOS" />
        ) : (
          <FormPlanilla accion={accionSubirPlanilla.bind(null, id, "INGRESOS")} texto="Ver vista previa" />
        )}
      </Seccion>

      <Seccion titulo="Cargar un pago">
        <FormIngreso accion={accionAgregarIngreso.bind(null, id)} codigos={codigos} fechaSugerida={fechaSugerida} />
      </Seccion>

      <Seccion titulo={`Pagos cargados (${ingresos.length})`}>
        {ingresos.length === 0 ? (
          <p className="text-pizarra-suave">Todavía no hay pagos. Importá la planilla del banco o cargalos de a uno.</p>
        ) : (
          <>
            <p>
              Total: <Monto valor={total} conSimbolo className="font-bold" />
            </p>
            <ul className="flex flex-col divide-y divide-junta">
              {ingresos.map((i) => {
                const codigo = formatearCodigo({ torre: i.unidad.torre.codigo, numero: i.unidad.numero, sufijo: i.sufijo });
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                    <div className="min-w-0">
                      <span className="font-mono font-bold">{codigo}</span>{" "}
                      <Monto valor={i.monto} conSimbolo className="font-bold" />
                      <p className="text-chico text-pizarra-suave">
                        {formatearFecha(fechaIso(i.fecha))}, {ORIGEN[i.origen].toLowerCase()}
                        {i.referencia ? `, ${i.referencia}` : ""}
                      </p>
                    </div>
                    <BotonQuitar accion={accionEliminarIngreso.bind(null, id, i.id)} etiqueta={`Quitar el pago de ${codigo}`} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Seccion>

      <Seccion titulo="Depósitos no identificados">
        <p className="max-w-prose text-pizarra-suave">
          Plata que entró a la cuenta sin decir de qué unidad es. Figura en el PDF hasta que la asignes a una unidad; al asignarla se
          carga como pago de esa unidad.
        </p>
        {sinIdentificar.length > 0 && (
          <ul className="flex flex-col divide-y divide-junta">
            {sinIdentificar.map((d) => (
              <li key={d.id} className="flex flex-col gap-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <Monto valor={d.monto} conSimbolo className="font-bold" />{" "}
                    <span className="text-pizarra-suave">
                      {d.forma} del {formatearFecha(fechaIso(d.fecha))}
                      {d.documento ? `, documento ${d.documento}` : ""}
                    </span>
                  </p>
                  {d.cargadoEnId === id && (
                    <BotonQuitar accion={accionEliminarDeposito.bind(null, id, d.id)} etiqueta="Quitar el depósito" />
                  )}
                </div>
                <FormIdentificar accion={accionIdentificarDeposito.bind(null, id, d.id)} codigos={codigos} />
              </li>
            ))}
          </ul>
        )}
        {identificados.length > 0 && (
          <>
            <h3 className="font-bold">Asignados en esta liquidación</h3>
            <ul className="flex flex-col divide-y divide-junta">
              {identificados.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <p>
                    <Monto valor={d.monto} conSimbolo className="font-bold" /> a{" "}
                    <span className="font-mono font-bold">
                      {d.ingreso && formatearCodigo({ torre: d.ingreso.unidad.torre.codigo, numero: d.ingreso.unidad.numero, sufijo: d.ingreso.sufijo })}
                    </span>
                  </p>
                  {d.ingresoId && <BotonQuitar accion={accionEliminarIngreso.bind(null, id, d.ingresoId)} etiqueta="Desasignar el depósito" />}
                </li>
              ))}
            </ul>
          </>
        )}
        <h3 className="font-bold">Cargar un depósito sin identificar</h3>
        <FormDeposito accion={accionCargarDeposito.bind(null, id)} fechaSugerida={fechaSugerida} />
      </Seccion>
    </>
  );
}

function VistaPrevia({
  liquidacionId,
  imp,
  tipo,
}: {
  liquidacionId: string;
  imp: NonNullable<Awaited<ReturnType<typeof importacionPendiente>>>;
  tipo: "INGRESOS" | "SALDOS_INICIALES";
}) {
  const conAvisos = imp.filas.filter((f) => f.avisos.length > 0).length;
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-granito p-4">
      <p className="font-bold">
        Vista previa de “{imp.archivoNombre}”: {imp.filas.length} filas
        {tipo === "INGRESOS" && imp.errores === 0 && (
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
              <th scope="col" className="px-3 py-2 text-left">Unidad</th>
              {tipo === "INGRESOS" && <th scope="col" className="px-3 py-2 text-left">Fecha</th>}
              <th scope="col" className="px-3 py-2 text-right">{tipo === "INGRESOS" ? "Monto" : "Saldo"}</th>
              <th scope="col" className="px-3 py-2 text-left">Estado</th>
            </tr>
          </thead>
          <tbody>
            {imp.filas.map((f) => (
              <tr key={f.fila} className={`border-t border-junta ${f.errores.length ? "bg-alerta-fondo" : ""}`}>
                <td className="px-3 py-1.5">{f.fila}</td>
                <td className="px-3 py-1.5 font-mono font-bold whitespace-nowrap">{f.codigo || "—"}</td>
                {tipo === "INGRESOS" && <td className="px-3 py-1.5 whitespace-nowrap">{f.fecha ? formatearFecha(f.fecha) : "—"}</td>}
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
            texto={tipo === "INGRESOS" ? `Cargar ${imp.filas.length} ${imp.filas.length === 1 ? "pago" : "pagos"}` : "Cargar los saldos"}
          />
        )}
        <BotonAccion accion={accionDescartarImportacion.bind(null, liquidacionId, imp.id)} texto="Descartar planilla" variante="secundario" />
      </div>
    </div>
  );
}
