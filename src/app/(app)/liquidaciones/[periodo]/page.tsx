import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/ui/aviso";
import { Monto } from "@/componentes/ui/monto";
import { centesimos } from "@/dominio/dinero";
import { puede } from "@/dominio/permisos";
import { esPeriodo, formatearFecha, nombreMes, periodoEnFrase, vencimiento } from "@/dominio/liquidacion/periodo";
import { verLiquidacion } from "@/servidor/liquidacion/consulta";
import { estadoEnvios } from "@/servidor/liquidacion/publicar";
import { Volver } from "../../datos/volver";
import { accionAnular, accionReintentarEnvios } from "../acciones";
import { Anular, BotonAccion } from "../confeccion/formularios";
import { EnlacePdf, Estado, Recibo, Seccion, TablaLineas, TablaResumenEgresos } from "../partes";

export async function generateMetadata({ params }: { params: Promise<{ periodo: string }> }): Promise<Metadata> {
  const { periodo } = await params;
  return { title: esPeriodo(periodo) ? `Liquidación de ${periodoEnFrase(periodo)}` : "Liquidación" };
}

export default async function PaginaLiquidacion({
  params,
  searchParams,
}: {
  params: Promise<{ periodo: string }>;
  searchParams: Promise<{ id?: string; publicada?: string }>;
}) {
  const { periodo } = await params;
  const { id, publicada } = await searchParams;
  if (!esPeriodo(periodo)) notFound();
  const datos = await verLiquidacion(periodo, id);
  if (!datos) notFound();
  const { liquidacion: liq, propias, armada, usuario } = datos;
  const vence = vencimiento(liq.periodo, liq.diaVencimiento);
  const administra = puede(usuario, "liquidacion.publicar");
  const envios = administra && liq.estado === "PUBLICADA" ? await estadoEnvios(liq.id) : null;

  return (
    <>
      <Volver href="/liquidaciones" texto="Todas las liquidaciones" />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-grande font-bold">Liquidación de {periodoEnFrase(liq.periodo)}</h1>
        {(liq.estado === "ANULADA" || liq.rectificaId) && <Estado estado={liq.estado} />}
      </div>
      <p className="mt-1 text-pizarra-suave">
        {liq.publicadaEn ? `Publicada el ${formatearFecha(liq.publicadaEn.toISOString())}. ` : ""}
        {liq.rectificaId ? "Es la versión corregida: reemplaza a la anterior. " : ""}
        Vence el {formatearFecha(vence)}.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {publicada && <Aviso tono="ok">Publicaste la liquidación y la enviamos por mail con el PDF adjunto.</Aviso>}
        {liq.estado === "ANULADA" && (
          <Aviso tono="error">
            Esta liquidación fue anulada{liq.anuladaEn ? ` el ${formatearFecha(liq.anuladaEn.toISOString())}` : ""}. Motivo: {liq.motivoAnulacion}
          </Aviso>
        )}

        {propias.length > 0 && (
          <section aria-labelledby="tu-cuenta" className="flex flex-col gap-4">
            <h2 id="tu-cuenta" className="text-titulo font-bold">
              {propias.length > 1 ? "Tus cuentas" : "Tu cuenta"} de {nombreMes(liq.periodo)}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {propias.map((l) => (
                <Recibo key={l.id} linea={l} vence={vence} />
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {liq.estado !== "BORRADOR" && <EnlacePdf id={liq.id} texto="Ver la liquidación completa (PDF)" />}
        </div>
        {propias.length === 0 && !armada && (
          <p className="max-w-prose text-pizarra-suave">
            En el PDF está la liquidación completa del mes: egresos, disponibilidades y el detalle por unidad.
          </p>
        )}

        {envios && (
          <Seccion titulo="Envío por mail">
            <p>
              <strong>{envios.enviados}</strong> enviados
              {envios.pendientes > 0 && <>, <strong>{envios.pendientes}</strong> pendientes</>}
              {envios.errores > 0 && (
                <>
                  , <strong className="text-alerta">{envios.errores} con error</strong>
                </>
              )}
              .
            </p>
            {envios.conError.length > 0 && (
              <ul className="list-disc pl-6 text-chico">
                {envios.conError.map((e) => (
                  <li key={e.destinatario} className="break-words">
                    {e.destinatario}: {e.error}
                  </li>
                ))}
              </ul>
            )}
            {envios.pendientes + envios.errores > 0 && (
              <BotonAccion accion={accionReintentarEnvios.bind(null, liq.id)} texto="Reintentar los que faltan" variante="secundario" />
            )}
          </Seccion>
        )}

        {armada && (
          <>
            <Seccion titulo="Resumen">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Dato etiqueta="Total a cobrar" valor={armada.totales.saldoAPagar} />
                <Dato etiqueta="Pagos del mes" valor={armada.totales.pagos} />
                <Dato etiqueta="Egresos del mes" valor={armada.resumen.total} />
              </dl>
              <dl className="grid gap-4 sm:grid-cols-3">
                <Dato etiqueta="Fondo gastos comunes al cierre" valor={armada.cuenta.saldoFinal.gc} />
                <Dato etiqueta="Fondo de reserva al cierre" valor={armada.cuenta.saldoFinal.fr} />
                <Dato etiqueta="Depósitos sin identificar" valor={armada.totalDepositosPendientes} />
              </dl>
            </Seccion>
            <Seccion titulo="Detalle por unidad">
              <p className="text-pizarra-suave">{armada.lineas.length} líneas. Deslizá la tabla para ver todas las columnas.</p>
              <TablaLineas lineas={armada.lineas} totales={armada.totales} titulo={`Detalle por unidad de ${periodoEnFrase(liq.periodo)}`} />
            </Seccion>
            <Seccion titulo="Egresos por rubro">
              <TablaResumenEgresos resumen={armada.resumen} />
            </Seccion>
          </>
        )}

        {administra && liq.estado === "PUBLICADA" && (
          <Seccion titulo="¿Hay un error?">
            <p className="max-w-prose text-pizarra-suave">
              Una liquidación publicada no se modifica. Si hay que corregirla, se anula (queda registrado quién y por qué) y se publica una
              versión rectificada. Solo se puede anular la última liquidación publicada.
            </p>
            <Anular accion={accionAnular.bind(null, liq.id)} />
          </Seccion>
        )}
      </div>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div>
      <dt className="text-pizarra-suave">{etiqueta}</dt>
      <dd className="text-medio font-bold">
        <Monto valor={centesimos(valor)} conSimbolo />
      </dd>
    </div>
  );
}
