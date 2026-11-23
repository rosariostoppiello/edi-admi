import type { Metadata } from "next";
import { Monto } from "@/componentes/ui/monto";
import { formatearCodigo } from "@/dominio/codigos";
import { codigosVigentes, listarCargos } from "@/servidor/liquidacion/confeccion";
import { accionAgregarCargo, accionEliminarCargo } from "../../../acciones";
import { Seccion } from "../../../partes";
import { BotonQuitar, FormCargo, TIPOS_CARGO } from "../../formularios";

export const metadata: Metadata = { title: "Cargos extra de la liquidación" };

export default async function PaginaCargos({ params }: PageProps<"/liquidaciones/confeccion/[id]/cargos">) {
  const { id } = await params;
  const [cargos, codigos] = await Promise.all([listarCargos(id), codigosVigentes()]);
  return (
    <>
      <Seccion titulo="Cargar un cargo extra">
        <p className="max-w-prose text-pizarra-suave">
          Cargos puntuales de una unidad este mes: uso de la barbacoa, una multa, o en “Otros” un tag de garaje o un ajuste
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
              const codigo = formatearCodigo({ torre: c.unidad.torre.codigo, numero: c.unidad.numero, sufijo: c.sufijo });
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
