import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { exigirUsuario } from "@/servidor/sesion";
import { buscarModulo, subteclasVisibles } from "../modulos";

/**
 * Pantalla de sub-botones de los módulos que no tienen carpeta propia todavía
 * (Reservas, Solicitudes, Comunicados, Teléfonos). Cada fase crea su carpeta,
 * que tiene prioridad sobre esta ruta dinámica.
 */
export async function generateMetadata({ params }: PageProps<"/[modulo]">): Promise<Metadata> {
  const modulo = buscarModulo(`/${(await params).modulo}`);
  return { title: modulo?.nombre ?? "Sección" };
}

export default async function PaginaModulo({ params }: PageProps<"/[modulo]">) {
  const usuario = await exigirUsuario();
  const modulo = buscarModulo(`/${(await params).modulo}`);
  if (!modulo) notFound();
  return <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)} />;
}
