import type { Metadata } from "next";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { exigirPermiso } from "@/servidor/sesion";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Comunicados de la Administración" };

/** Avisos importantes · Reglamentos · Actas de asambleas (C.4). */
export default async function PaginaComunicados() {
  const usuario = await exigirPermiso("comunicado.ver");
  const modulo = buscarModulo("/comunicados")!;
  return <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)} />;
}
