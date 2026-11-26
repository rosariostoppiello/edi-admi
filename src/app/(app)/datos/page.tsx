import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { exigirUsuario } from "@/servidor/sesion";
import { unidadActiva } from "@/servidor/unidad-activa";
import { TeclaChica, Teclado } from "@/componentes/ui/teclas";
import { Ficha } from "./ficha";
import { Volver } from "./volver";

export const metadata: Metadata = { title: "Datos de propietarios e inquilinos" };

export default async function PaginaDatos() {
  const usuario = await exigirUsuario();
  const activa = await unidadActiva(usuario);
  const veListado = puede(usuario, "datos.verTodos") || puede(usuario, "datos.verOcupantes");

  // Sin unidad propia (Administración, Portería, Comisión sin unidad): directo al listado.
  if (!activa) {
    if (veListado) redirect("/datos/unidades");
    redirect("/inicio");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Volver />
        {veListado && (
          <Link href="/datos/unidades" className="inline-flex min-h-11 items-center px-2 font-bold underline underline-offset-4 hover:text-bronce-texto">
            Ver todas las unidades
          </Link>
        )}
      </div>
      <div className="mt-4">
        <Ficha
          unidadId={activa.unidadId}
          modo="ver"
          acciones={
            <Teclado etiqueta="Datos de propietarios e inquilinos">
              <li>
                <TeclaChica href="/datos/editar" nombre="Editar" />
              </li>
            </Teclado>
          }
        />
      </div>
    </>
  );
}
