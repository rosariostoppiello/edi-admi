import type { Metadata } from "next";
import { db } from "@/servidor/db";
import { exigirPermiso } from "@/servidor/sesion";
import { Volver } from "../volver";
import { FormNuevaUnidad } from "./form";

export const metadata: Metadata = { title: "Nueva unidad" };

export default async function PaginaNuevaUnidad() {
  await exigirPermiso("unidades.administrar");
  const torres = await db.torre.findMany({ orderBy: { orden: "asc" } });
  return (
    <>
      <Volver href="/datos/unidades" texto="Todas las unidades" />
      <h1 className="mt-4 text-grande font-bold">Nueva unidad</h1>
      <p className="mt-1 max-w-prose text-pizarra-suave">
        Toda unidad tiene que tener un responsable (propietario o promitente comprador). Le mandamos un mail
        para que cree su contraseña.
      </p>
      <FormNuevaUnidad torres={torres.map((t) => ({ codigo: t.codigo, nombre: t.nombre }))} />
    </>
  );
}
