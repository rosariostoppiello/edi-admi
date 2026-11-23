import type { Metadata } from "next";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { exigirPermiso } from "@/servidor/sesion";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Liquidación de gastos comunes" };

/** Liquidación mensual (todos) y Confección (solo Administración). Una unidad salta directo. */
export default async function PaginaLiquidaciones() {
  const usuario = await exigirPermiso("liquidacion.ver");
  const modulo = buscarModulo("/liquidaciones")!;
  return <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)} />;
}
