import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { exigirUsuario } from "@/servidor/sesion";
import { IconoVolver } from "@/componentes/ui/iconos";
import { accionSolicitarEdificio } from "../acciones";
import { FormNuevoEdificio } from "../partes";

export const metadata: Metadata = { title: "Agregar un edificio" };

/** Un administrador pide el alta de otro edificio; lo aprueba el dueño del sistema (decisión 86). */
export default async function PaginaNuevoEdificio() {
  if (!puede(await exigirUsuario(), "edificio.solicitarAlta")) notFound();
  return (
    <>
      <Link href="/edificio" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce-texto">
        <IconoVolver className="size-5" />
        Configuración del edificio
      </Link>
      <h1 className="mt-4 text-grande font-bold">Agregar un edificio</h1>
      <p className="mt-1 max-w-prose text-pizarra-suave">
        Cada edificio es independiente: sus unidades, su liquidación y su cobranza. El dueño del sistema revisa el pedido; cuando lo apruebe, quedás como su
        Administración y aparece en tus edificios.
      </p>
      <div className="mt-6 max-w-2xl rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <FormNuevoEdificio accion={accionSolicitarEdificio} />
      </div>
    </>
  );
}
