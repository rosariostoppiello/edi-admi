import type { Metadata } from "next";
import { codigoBase } from "@/dominio/codigos";
import { listarCuotas } from "@/servidor/liquidacion/confeccion";
import { accionGuardarCuotas } from "../../../acciones";
import { Seccion } from "../../../partes";
import { FilaCuotas } from "../../formularios";

export const metadata: Metadata = { title: "Cuotas por unidad" };

const TIPO = { APTO: "Apartamento", LOCAL: "Local", GARAJE: "Garaje", OFICINA: "Oficina" } as const;

export default async function PaginaCuotas() {
  const unidades = await listarCuotas();
  return (
    <Seccion titulo="Cuotas mensuales por unidad">
      <div className="max-w-prose text-pizarra-suave">
        <p>Montos fijos de cada mes. Se mantienen hasta que los cambies, y el cambio vale desde esta liquidación.</p>
        <ul className="mt-2 list-disc pl-6">
          <li><strong className="text-pizarra">Gasto común:</strong> el ordinario. En una unidad alquilada lo paga el inquilino.</li>
          <li><strong className="text-pizarra">Parte del propietario:</strong> lo de cargo del propietario (ej. seguro). Siempre lo paga él.</li>
          <li><strong className="text-pizarra">Fondo de reserva:</strong> se calcula solo sobre la suma y lo paga el propietario.</li>
          <li><strong className="text-pizarra">Cuota extra F.R.:</strong> aporte extra al fondo de reserva, si la asamblea lo resolvió. La paga el propietario. Dejala en 0 si no se usa.</li>
        </ul>
      </div>
      <ul className="flex flex-col divide-y divide-junta">
        {unidades.map((u) => (
          <li key={u.id}>
            <FilaCuotas
              accion={accionGuardarCuotas.bind(null, u.id)}
              codigo={codigoBase(u.torre.numero, u.numero)}
              descripcion={`${TIPO[u.tipo]} en ${u.torre.nombre}${u.arrendada ? ", alquilada" : ""}`}
              valores={{ gcUnidad: u.gcUnidad, gcPropietario: u.gcPropietario, gcGaraje: u.gcGaraje, cuotaExtraFr: u.cuotaExtraFr, garajeACargoDe: u.garajeACargoDe, arrendada: u.arrendada }}
            />
          </li>
        ))}
      </ul>
    </Seccion>
  );
}
