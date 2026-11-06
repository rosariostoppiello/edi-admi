import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconoVolver } from "@/componentes/ui/iconos";
import { MODULOS } from "../modulos";

/**
 * Página provisoria de cada sección mientras no está implementada.
 * Cada fase la reemplaza creando su carpeta propia (ej. app/(app)/reservas/),
 * que tiene prioridad sobre esta ruta dinámica.
 */
function buscar(ruta: string) {
  return MODULOS.find((m) => m.ruta === `/${ruta}`);
}

export async function generateMetadata({ params }: { params: Promise<{ modulo: string }> }): Promise<Metadata> {
  const modulo = buscar((await params).modulo);
  return { title: modulo?.nombre ?? "Sección" };
}

export default async function SeccionPendiente({ params }: { params: Promise<{ modulo: string }> }) {
  const modulo = buscar((await params).modulo);
  if (!modulo) notFound();
  const { nombre, descripcion, Icono } = modulo;

  return (
    <>
      <Link href="/" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce">
        <IconoVolver className="size-5" />
        Inicio
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <Icono className="size-10 shrink-0 text-bronce" />
        <h1 className="text-grande font-bold">{nombre}</h1>
      </div>
      <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
        <p className="font-bold">Esta sección todavía está en construcción.</p>
        <p className="mt-2 text-pizarra-suave">
          Acá vas a poder ver: {descripcion.charAt(0).toLowerCase() + descripcion.slice(1)}. Mientras
          tanto, cualquier consulta hacela directamente con la administración.
        </p>
      </div>
    </>
  );
}
