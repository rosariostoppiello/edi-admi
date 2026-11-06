import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/componentes/ui/aviso";
import { Monto } from "@/componentes/ui/monto";
import { formatearFecha, nombreMes, vencimiento } from "@/dominio/liquidacion/periodo";
import { armarLiquidacion } from "@/servidor/liquidacion/armado";
import { listarCuotas, obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { resumenSaldosIniciales } from "@/servidor/liquidacion/importar";
import { contarDestinatarios } from "@/servidor/liquidacion/publicar";
import { accionEliminarBorrador, accionPublicar } from "../../../acciones";
import { EnlacePdf, Seccion, TablaLineas, TablaResumenEgresos } from "../../../partes";
import { EliminarBorrador, Publicar } from "../../formularios";

export const metadata: Metadata = { title: "Revisar y publicar la liquidación" };

export default async function PaginaRevision({ params, searchParams }: PageProps<"/liquidaciones/confeccion/[id]/revision">) {
  const { id } = await params;
  const { rectificacion } = await searchParams;
  const liq = (await obtenerBorrador(id))!;
  const [armada, destinatarios, unidades] = await Promise.all([armarLiquidacion(id), contarDestinatarios(id), listarCuotas()]);
  const l = armada!;
  const saldos = liq.primera ? await resumenSaldosIniciales(id) : null;
  const sinCuotas = unidades.filter((u) => u.gcUnidad + u.gcPropietario + u.gcGaraje === 0).length;
  const base = `/liquidaciones/confeccion/${id}`;

  const avisos: { texto: React.ReactNode; grave?: boolean }[] = [];
  if (l.sinUbicar.length) avisos.push({ texto: "Hay saldos o pagos de unidades que ya no están activas. Así no se puede publicar.", grave: true });
  if (saldos && saldos.cantidad === 0) {
    avisos.push({ texto: <>No cargaste los saldos anteriores: todas las unidades arrancan en cero. <Link className="underline" href={`${base}/ingresos`}>Cargarlos</Link></> });
  }
  if (l.egresos.length === 0) avisos.push({ texto: <>No hay egresos cargados. <Link className="underline" href={`${base}/egresos`}>Cargar egresos</Link></> });
  if (l.totales.pagos === 0) avisos.push({ texto: <>No hay pagos cargados este mes. <Link className="underline" href={`${base}/ingresos`}>Cargar pagos</Link></> });
  if (sinCuotas) avisos.push({ texto: <>{sinCuotas === 1 ? "Hay 1 unidad" : `Hay ${sinCuotas} unidades`} sin cuotas (gasto común en cero). <Link className="underline" href={`${base}/cuotas`}>Revisar cuotas</Link></> });
  if (destinatarios.lineasSinMail.length) {
    avisos.push({
      texto: `${destinatarios.lineasSinMail.length} líneas no tienen mail registrado y no van a recibir la liquidación: ${destinatarios.lineasSinMail.slice(0, 8).join(", ")}${destinatarios.lineasSinMail.length > 8 ? "…" : ""}.`,
    });
  }

  return (
    <>
      {rectificacion && (
        <Aviso tono="info">
          Anulaste la liquidación publicada. Este borrador es una copia con todo lo que tenía: corregí lo necesario y publicala de nuevo.
        </Aviso>
      )}

      <Seccion titulo="Antes de publicar">
        {avisos.length === 0 ? (
          <Aviso tono="ok">Está todo cargado. Revisá los totales y el PDF.</Aviso>
        ) : (
          <ul className="flex flex-col gap-2">
            {avisos.map((a, i) => (
              <li key={i}>
                <Aviso tono={a.grave ? "error" : "info"}>{a.texto}</Aviso>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato etiqueta="Total a cobrar" valor={l.totales.saldoAPagar} />
          <Dato etiqueta="Pagos del mes" valor={l.totales.pagos} />
          <Dato etiqueta="Egresos del mes" valor={l.resumen.total} />
          <Dato etiqueta="Fondo de reserva del mes" valor={l.totales.fondoReserva} />
        </dl>
        <p className="text-pizarra-suave">
          {l.lineas.length} líneas. Vence el {formatearFecha(vencimiento(l.periodo, l.diaVencimiento))}.
        </p>
        <div>
          <EnlacePdf id={id} texto="Ver el PDF borrador" />
        </div>
      </Seccion>

      <Seccion titulo="Detalle por unidad">
        <TablaLineas lineas={l.lineas} totales={l.totales} titulo="Vista previa del detalle por unidad" />
      </Seccion>

      <Seccion titulo="Egresos por rubro">
        <TablaResumenEgresos resumen={l.resumen} />
      </Seccion>

      <Seccion titulo="Publicar">
        <p className="max-w-prose">
          Al publicar se guarda la liquidación tal como está, se genera el PDF y se envía por mail a{" "}
          <strong>{destinatarios.mails} {destinatarios.mails === 1 ? "destinatario" : "destinatarios"}</strong>. Después ya no se puede
          modificar: solo anularla y publicar una corrección.
        </p>
        <Publicar
          accion={accionPublicar.bind(null, id)}
          explicacion={
            <p>
              Vas a publicar la liquidación de <strong>{nombreMes(l.periodo)}</strong>
              {liq.rectificaId ? " como rectificada" : ""} y mandarla por mail a <strong>{destinatarios.mails}</strong>{" "}
              {destinatarios.mails === 1 ? "persona" : "personas"}. Total a cobrar: <Monto valor={l.totales.saldoAPagar} conSimbolo />.
            </p>
          }
        />
        {!liq.rectificaId && (
          <div className="border-t border-junta pt-4">
            <EliminarBorrador accion={accionEliminarBorrador.bind(null, id)} />
          </div>
        )}
      </Seccion>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <dt className="text-pizarra-suave">{etiqueta}</dt>
      <dd className="text-medio font-bold">
        <Monto valor={valor} conSimbolo />
      </dd>
    </div>
  );
}
