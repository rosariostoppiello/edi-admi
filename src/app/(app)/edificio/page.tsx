import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { IconoVolver } from "@/componentes/ui/iconos";
import { BotonEnlace } from "@/componentes/ui/boton";
import { puede } from "@/dominio/permisos";
import { MODULOS_OPCIONALES, moduloPrendido } from "../modulos";
import { accionGuardarModulos } from "../edificios/acciones";
import { FormModulos } from "../edificios/partes";

export const metadata: Metadata = { title: "Configuración del edificio" };

/** Administración elige los módulos del edificio (decisión 87) y puede pedir otro edificio. */
export default async function PaginaEdificio() {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "edificio.configurarModulos")) notFound();
  const modulos = MODULOS_OPCIONALES.map((m) => ({ ruta: m.ruta, nombre: m.nombre, prendido: moduloPrendido(usuario.edificio.modulos, m.ruta) }));
  return (
    <>
      <Link href="/inicio" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce-texto">
        <IconoVolver className="size-5" />
        Inicio
      </Link>
      <h1 className="mt-4 text-grande font-bold">Configuración del edificio</h1>
      <p className="mt-1 text-pizarra-suave">{usuario.edificio.nombre}</p>
      <section aria-labelledby="modulos" className="mt-6 flex max-w-2xl flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <h2 id="modulos" className="text-titulo font-bold">
          Módulos
        </h2>
        <FormModulos accion={accionGuardarModulos} modulos={modulos} />
        <p className="text-chico text-pizarra-suave">La piscina se agrega en Reservas → Configurar los espacios, como un espacio de tipo “Piscina”.</p>
      </section>
      {puede(usuario, "edificio.solicitarAlta") && (
        <section aria-labelledby="otro" className="mt-6 flex max-w-2xl flex-col gap-3">
          <h2 id="otro" className="text-titulo font-bold">
            Otro edificio
          </h2>
          <p>Si administrás otro edificio, podés pedir que se agregue al sistema.</p>
          <BotonEnlace href="/edificios/nuevo" variante="secundario" className="self-start">
            Agregar un edificio
          </BotonEnlace>
        </section>
      )}
    </>
  );
}
