import type { Metadata } from "next";
import { Monto } from "@/componentes/ui/monto";
import { formatearCodigo } from "@/dominio/codigos";
import { codigosVigentes, contarReservasSinCobrar, listarCargos } from "@/servidor/liquidacion/confeccion";
import { accionAgregarCargo, accionEliminarCargo, accionTraerReservas } from "../../../acciones";
import { Seccion } from "../../../partes";
import { BotonAccion, BotonQuitar, FormCargo } from "../../formularios";
import { TIPOS_CARGO } from "../../tipos-cargo";

export const metadata: Metadata = { title: "Cargos extra de la liquidación" };

export default async function PaginaCargos({ params }: PageProps<"/liquidaciones/confeccion/[id]/cargos">) {
  const { id } = await params;
  const [cargos, codigos, sinCobrar] = await Promise.all([listarCargos(id), codigosVigentes(), contarReservasSinCobrar(id)]);
  return (
    <>
      <Seccion titulo="Reservas de barbacoa">
        <p className="max-w-prose text-pizarra-suave">
          {sinCobrar === 0
            ? "No hay reservas de barbacoa de este mes pendientes de cobro."
            : `Hay ${sinCobrar} ${sinCobrar === 1 ? "reserva" : "reservas"} de barbacoa de este mes sin cobrar. Se cargan con la tarifa de cada barbacoa a la línea de quien reservó.`}{" "}
          Si traés las reservas dos veces, no se cobran dos veces.
        </p>
        <BotonAccion accion={accionTraerReservas.bind(null, id)} texto="Traer las reservas de barbacoa del mes" variante={sinCobrar ? "primario" : "secundario"} />
      </Seccion>
      <Seccion titulo="Cargar un cargo extra">
        <p className="max-w-prose text-pizarra-suave">
          Cargos puntuales de una unidad este mes: una barbacoa que no se reservó por el sistema, una multa, o en “Otros” un tag de garaje o un ajuste
          (negativo para bonificar).
        </p>
        <FormCargo accion={accionAgregarCargo.bind(null, id)} codigos={codigos} />
      </Seccion>
      <Seccion titulo={`Cargos de este mes (${cargos.length})`}>
        {cargos.length === 0 ? (
          <p className="text-pizarra-suave">No hay cargos extra este mes.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-junta">
            {cargos.map((c) => {
              const codigo = formatearCodigo({ torre: c.unidad.torre.numero, numero: c.unidad.numero, sufijo: c.sufijo });
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold">{codigo}</span> <Monto valor={c.monto} conSimbolo className="font-bold" />
                    <p className="text-chico text-pizarra-suave">
                      {TIPOS_CARGO[c.tipo]}: {c.concepto}
                    </p>
                  </div>
                  <BotonQuitar accion={accionEliminarCargo.bind(null, id, c.id)} etiqueta={`Quitar el cargo de ${codigo}`} />
                </li>
              );
            })}
          </ul>
        )}
      </Seccion>
    </>
  );
}
