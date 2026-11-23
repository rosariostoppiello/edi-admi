import type { Metadata } from "next";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { exigirPermiso } from "@/servidor/sesion";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Teléfonos y datos de interés" };

/** Administración · Comisión administradora · Portería · Empresas · Servicios públicos · Seguro de incendio (C.5). */
export default async function PaginaTelefonos() {
  const usuario = await exigirPermiso("telefonos.ver");
  const modulo = buscarModulo("/telefonos")!;
  return <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)} />;
}
