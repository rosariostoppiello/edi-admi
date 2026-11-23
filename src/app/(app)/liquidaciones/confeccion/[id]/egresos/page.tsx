import type { Metadata } from "next";
import { Monto } from "@/componentes/ui/monto";
import { formatearNumero, type Centesimos } from "@/dominio/dinero";
import { fechaIso, formatearFecha, nombrePeriodo, periodoAnterior, rangoPeriodo } from "@/dominio/liquidacion/periodo";
import { listarEgresosYRubros, obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { importacionPendiente } from "@/servidor/liquidacion/importar";
import {
  accionAgregarEgreso,
  accionAgregarRubro,
  accionDesactivarFijo,
  accionEditarEgreso,
  accionEliminarEgreso,
  accionSubirPlanilla,
} from "../../../acciones";
import { Seccion } from "../../../partes";
import { AgregarRubro, BotonQuitar, EditarEgreso, FormEgreso, FormPlanilla, type OpcionRubro } from "../../formularios";
import { VistaPrevia } from "../../vista-previa";

export const metadata: Metadata = { title: "Egresos de la liquidación" };

export default async function PaginaEgresos({ params }: PageProps<"/liquidaciones/confeccion/[id]/egresos">) {
  const { id } = await params;
  const liq = (await obtenerBorrador(id))!;
  const { egresos, rubros, fijos, proveedores } = await listarEgresosYRubros(id);
  const pendiente = await importacionPendiente(id, "EGRESOS");
  const total = egresos.reduce((s, e) => s + e.monto, 0);

  // Rubros para el selector, agrupados por su rubro padre.
  const porId = new Map(rubros.map((r) => [r.id, r]));
  const conHijos = new Set(rubros.map((r) => r.padreId).filter(Boolean));
  const opciones: OpcionRubro[] = rubros
    .filter((r) => !conHijos.has(r.id))
    .map((r) => {
      const padre = r.padreId ? porId.get(r.padreId) : null;
      return { id: r.id, codigo: r.codigo, nombre: r.nombre, grupo: padre ? `${padre.codigo} ${padre.nombre}` : "Otros rubros" };
    });
  const hoy = new Date().toISOString().slice(0, 10);
  const { desde, hasta } = rangoPeriodo(liq.periodo);

  return (
    <>
      <Seccion titulo="Importar egresos desde una planilla">
        <p className="max-w-prose text-pizarra-suave">
          La planilla tiene que tener una fila de encabezados con <strong>Fecha</strong>, <strong>Rubro</strong> (el código del subrubro,
          ej. 3.3), <strong>Proveedor</strong>, <strong>Período</strong> (ej. Agosto 2026) y <strong>Monto</strong>. Antes de cargar nada te
          mostramos cada fila con sus errores.
        </p>
        {pendiente ? (
          <VistaPrevia liquidacionId={id} imp={pendiente} tipo="EGRESOS" />
        ) : (
          <FormPlanilla accion={accionSubirPlanilla.bind(null, id, "EGRESOS")} texto="Ver vista previa" />
        )}
      </Seccion>

      <Seccion titulo="Cargar un egreso">
        <p className="max-w-prose text-pizarra-suave">
          Cada pago del mes: el rubro, a quién se le pagó, a qué período corresponde (suele ser el mes anterior) y el monto.
        </p>
        <FormEgreso
          accion={accionAgregarEgreso.bind(null, id)}
          rubros={opciones}
          proveedores={proveedores}
          fechaSugerida={hoy >= desde && hoy <= hasta ? hoy : desde}
          detalleSugerido={nombrePeriodo(periodoAnterior(liq.periodo))}
        />
      </Seccion>

      <Seccion titulo={`Egresos del mes (${egresos.length})`}>
        {egresos.length === 0 ? (
          <p className="text-pizarra-suave">Todavía no hay egresos. Los que se repiten todos los meses aparecen solos al crear la liquidación.</p>
        ) : (
          <>
            <p>
              Total: <Monto valor={total} conSimbolo className="font-bold" />
            </p>
            <ul className="flex flex-col divide-y divide-junta">
              {egresos.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-bold">{e.proveedor}</span> <Monto valor={e.monto} conSimbolo className="font-bold" />
                      {e.fijoId && (
                        <span className="ml-2 rounded-full border border-junta-fuerte px-2 text-chico text-pizarra-suave">Fijo</span>
                      )}
                    </p>
                    <p className="text-chico text-pizarra-suave">
                      {e.rubro.codigo} {e.rubro.nombre}, {e.detalle}, pagado el {formatearFecha(fechaIso(e.fecha))}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <EditarEgreso
                      accion={accionEditarEgreso.bind(null, id, e.id)}
                      rubros={opciones}
                      proveedores={proveedores}
                      valores={{
                        rubroId: e.rubroId,
                        fecha: fechaIso(e.fecha),
                        proveedor: e.proveedor,
                        detalle: e.detalle,
                        monto: formatearNumero(e.monto as Centesimos),
                      }}
                    />
                    <BotonQuitar accion={accionEliminarEgreso.bind(null, id, e.id)} etiqueta={`Quitar el egreso de ${e.proveedor}`} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Seccion>

      <Seccion titulo="Egresos fijos">
        <p className="max-w-prose text-pizarra-suave">
          Se precargan en cada liquidación nueva con su monto habitual. Para agregar uno, marcá “Se repite todos los meses” al cargarlo.
        </p>
        {fijos.length === 0 ? (
          <p>No hay egresos fijos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-junta">
            {fijos.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <p className="min-w-0">
                  <span className="font-bold">{f.proveedor}</span> <Monto valor={f.monto} conSimbolo />
                  <span className="block text-chico text-pizarra-suave">
                    {f.rubro.codigo} {f.rubro.nombre}
                  </span>
                </p>
                <BotonQuitar accion={accionDesactivarFijo.bind(null, f.id)} etiqueta={`Dejar de precargar ${f.proveedor}`} texto="Dejar de precargar" />
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Rubros">
        <p className="max-w-prose text-pizarra-suave">
          Los rubros son las categorías de egresos del PDF (consumos estatales, mantenimiento, sueldos, portería, limpieza, obras…).
        </p>
        <ul className="columns-1 gap-8 text-chico sm:columns-2">
          {rubros.map((r) => (
            <li key={r.id} className={`break-inside-avoid py-0.5 ${r.padreId ? "pl-4" : "mt-2 font-bold"}`}>
              {r.codigo} {r.nombre}
              {r.cargoPropietario && <span className="font-normal text-pizarra-suave"> (cargo del propietario)</span>}
            </li>
          ))}
        </ul>
        <AgregarRubro accion={accionAgregarRubro} />
      </Seccion>
    </>
  );
}
