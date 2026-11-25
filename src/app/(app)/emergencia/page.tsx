import type { Metadata } from "next";
import Link from "next/link";
import { puede } from "@/dominio/permisos";
import { exigirPermiso } from "@/servidor/sesion";
import { telefonosDeAyuda } from "@/servidor/emergencias";
import { IconoVolver } from "@/componentes/ui/iconos";
import { accionAvisar } from "./acciones";
import { FormEmergencia } from "./form";

export const metadata: Metadata = { title: "Emergencia" };

/** Botón de emergencia (decisión 82): llamar primero, después avisar con doble confirmación. */
export default async function PaginaEmergencia() {
  const usuario = await exigirPermiso("emergencia.avisar");
  const telefonos = await telefonosDeAyuda();

  return (
    <>
      <Link
        href="/inicio"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce"
      >
        <IconoVolver className="size-5" />
        Inicio
      </Link>
      <h1 className="mt-4 text-grande font-bold text-alerta">Emergencia</h1>
      {puede(usuario, "emergencia.ver") && (
        <p className="mt-2">
          <Link
            href="/emergencia/avisos"
            className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce"
          >
            Ver los avisos de emergencia
          </Link>
        </p>
      )}
      <div className="mt-4 max-w-2xl">
        <FormEmergencia accion={accionAvisar} telefonos={telefonos} />
      </div>
    </>
  );
}
