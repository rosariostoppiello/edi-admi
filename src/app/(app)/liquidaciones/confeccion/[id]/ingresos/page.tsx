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
  accionEliminarDeposito,
  accionEliminarIngreso,
  accionIdentificarDeposito,
  accionSubirPlanilla,
} from "../../../acciones";
import { Seccion } from "../../../partes";
import { VistaPrevia } from "../../vista-previa";
import { BotonQuitar, FormDeposito, FormIdentificar, FormIngreso, FormPlanilla } from "../../formularios";

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

      <Seccion titulo="Cómo se identifica cada pago">
        <ul className="max-w-prose list-disc pl-6 text-pizarra-suave">
          <li>
            La referencia de cada pago es el <strong className="text-pizarra">código de la unidad</strong>, con la torre, el número y la
            letra: por ejemplo <span className="font-mono font-bold whitespace-nowrap text-pizarra">2-201-P</span>. A si no está alquilada, P el propietario,
            I el inquilino.
          </li>
          <li>
            En la planilla del banco o de la red de cobranza, ese código va en la columna <strong className="text-pizarra">Unidad</strong>.
          </li>
          <li>
            Si un pago llegó sin código, cargalo abajo como <strong className="text-pizarra">depósito no identificado</strong>. Cuando
            sepas de quién es (por el comprobante), asignalo a la unidad y se carga como su pago.
          </li>
        </ul>
      </Seccion>

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
