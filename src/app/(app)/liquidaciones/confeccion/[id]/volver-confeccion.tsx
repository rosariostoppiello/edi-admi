"use client";
import { usePathname } from "next/navigation";
import { Volver } from "../../../datos/volver";

/** En la pantalla de la confección vuelve al módulo; en cada sección, a la confección. */
export function VolverConfeccion({ id }: { id: string }) {
  const ruta = usePathname();
  const base = `/liquidaciones/confeccion/${id}`;
  return ruta === base ? (
    <Volver href="/liquidaciones" texto="Liquidación de gastos comunes" />
  ) : (
    <Volver href={base} texto="Confección de la liquidación" />
  );
}
