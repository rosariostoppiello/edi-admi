import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BotonEnlace } from "@/componentes/ui/boton";
import { codigoBase } from "@/dominio/codigos";
import { puede } from "@/dominio/permisos";
import { esDueno, NOMBRE_CALIDAD } from "@/dominio/personas";
import { listarOcupantes, listarUnidades } from "@/servidor/datos";
import { exigirUsuario } from "@/servidor/sesion";
import { Volver } from "../volver";
import { ListadoUnidades, type FilaUnidad } from "./listado";

export const metadata: Metadata = { title: "Unidades" };

export default async function PaginaUnidades() {
  const usuario = await exigirUsuario();
  let filas: FilaUnidad[];
  let completo = false;

  if (puede(usuario, "datos.verTodos")) {
    completo = true;
    const unidades = await listarUnidades();
    filas = unidades.map((u) => ({
      id: u.id,
      torre: u.torre.codigo,
      torreNombre: u.torre.nombre,
      codigo: codigoBase(u.torre.codigo, u.numero),
      personas: u.personas.map((p) => `${p.nombre} (${NOMBRE_CALIDAD[p.calidad].toLowerCase()})`),
      alquilada: u.arrendada,
      pendiente: u.personas.some((p) => esDueno(p.calidad) && !p.datosConfirmadosEn),
    }));
  } else if (puede(usuario, "datos.verOcupantes")) {
    // Portería: solo código y nombre del ocupante.
    const ocupantes = await listarOcupantes();
    filas = ocupantes.map((o) => ({
      id: o.id,
      torre: o.torre,
      torreNombre: o.torreNombre,
      codigo: codigoBase(o.torre, o.numero),
      personas: [o.ocupante],
      alquilada: o.arrendada,
      pendiente: false,
    }));
  } else {
    redirect("/datos");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Volver />
        {puede(usuario, "unidades.administrar") && (
          <BotonEnlace href="/datos/nueva" variante="secundario">
            Nueva unidad
          </BotonEnlace>
        )}
      </div>
      <h1 className="mt-4 text-grande font-bold">Unidades</h1>
      <p className="mt-1 text-pizarra-suave">
        {completo ? `${filas.length} unidades. Tocá una para ver sus datos.` : `${filas.length} unidades. Nombre del ocupante de cada una.`}
      </p>
      <ListadoUnidades filas={filas} conEnlace={completo} />
    </>
  );
}
