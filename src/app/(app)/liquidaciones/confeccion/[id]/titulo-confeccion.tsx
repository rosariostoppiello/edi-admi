"use client";
import { usePathname } from "next/navigation";
import { Volver } from "../../../datos/volver";

const SECCIONES: Record<string, string> = {
  egresos: "Egresos",
  ingresos: "Ingresos",
  cargos: "Cargos del mes",
  cuotas: "Cuotas por unidad",
  fondos: "Fondos y textos",
  revision: "Revisar y publicar",
};

/**
 * Encabezado de la confección. En la pantalla con las teclas, el título es la
 * liquidación; en cada sección, el nombre de la sección (con el mes arriba) y
 * el enlace para volver a la confección.
 */
export function TituloConfeccion({ id, liquidacion, estado }: { id: string; liquidacion: string; estado: React.ReactNode }) {
  const ruta = usePathname();
  const base = `/liquidaciones/confeccion/${id}`;
  const seccion = SECCIONES[ruta.slice(base.length + 1)];
  if (!seccion) {
    return (
      <>
        <Volver href="/liquidaciones" texto="Liquidación de gastos comunes" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-grande font-bold">{liquidacion}</h1>
          {estado}
        </div>
      </>
    );
  }
  return (
    <>
      <Volver href={base} texto="Confección de la liquidación" />
      <p className="mt-4 flex flex-wrap items-center gap-3 font-bold text-pizarra-suave">
        {liquidacion} {estado}
      </p>
      <h1 className="mt-1 text-grande font-bold">{seccion}</h1>
    </>
  );
}
