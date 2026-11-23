import type { Metadata } from "next";
import { formatearNumero, type Centesimos } from "@/dominio/dinero";
import { leerReglas } from "@/dominio/reservas";
import { listarEspacios, listarTorres } from "@/servidor/reservas";
import { notFound } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { exigirUsuario } from "@/servidor/sesion";
import { Seccion } from "../../liquidaciones/partes";
import { accionCrearEspacio, accionGuardarEspacio } from "../acciones";
import { Encabezado } from "../encabezado";
import { FormEspacio, FormNuevoEspacio } from "../partes";

export const metadata: Metadata = { title: "Configurar los espacios" };

const TIPOS = { BARBACOA: "Barbacoa", SOLARIUM: "Solarium", LAUNDRY: "Laundry", OTRO: "Otro" } as const;

/** Administración: tarifas, reglas, texto del laundry, alta y baja de espacios. */
export default async function PaginaEspacios() {
  if (!puede(await exigirUsuario(), "reserva.configurarEspacios")) notFound();
  const [espacios, torres] = await Promise.all([listarEspacios(undefined, { soloActivos: false }), listarTorres()]);
  const barbacoasSinSolarium = espacios.filter((e) => e.tipo === "BARBACOA" && !espacios.some((s) => s.barbacoaId === e.id));

  return (
    <>
      <Encabezado titulo="Configurar los espacios" />
      <p className="mt-3 max-w-prose text-pizarra-suave">
        La tarifa de cada barbacoa es la que se cobra en la liquidación del mes al traer las reservas. Los cambios valen para las reservas que se cobren desde ahora.
      </p>
      <div className="mt-6 flex flex-col gap-5">
        {espacios.map((e) => {
          const reglas = leerReglas(e.reglas);
          return (
            <div key={e.id} id={e.id} className="scroll-mt-4">
              <Seccion titulo={`${e.nombre}${e.activo ? "" : " (desactivado)"}`}>
                <p className="text-chico text-pizarra-suave">
                  {TIPOS[e.tipo]}
                  {e.barbacoa && `, atado a ${e.barbacoa.nombre}`}
                </p>
                <FormEspacio
                  accion={accionGuardarEspacio.bind(null, e.id)}
                  valores={{
                    nombre: e.nombre,
                    tipo: e.tipo,
                    tarifa: formatearNumero(e.tarifa as Centesimos),
                    descripcion: e.descripcion,
                    activo: e.activo,
                    ...reglas,
                  }}
                />
              </Seccion>
            </div>
          );
        })}
        <Seccion titulo="Agregar un espacio">
          <FormNuevoEspacio accion={accionCrearEspacio} torres={torres} barbacoasSinSolarium={barbacoasSinSolarium.map((b) => ({ id: b.id, nombre: b.nombre }))} />
        </Seccion>
      </div>
    </>
  );
}
