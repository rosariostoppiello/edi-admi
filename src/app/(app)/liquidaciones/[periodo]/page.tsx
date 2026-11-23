import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { esPeriodo, periodoEnFrase } from "@/dominio/liquidacion/periodo";
import { verLiquidacion } from "@/servidor/liquidacion/consulta";
import { VistaLiquidacion } from "../vista";

export async function generateMetadata({ params }: PageProps<"/liquidaciones/[periodo]">): Promise<Metadata> {
  const { periodo } = await params;
  return { title: esPeriodo(periodo) ? `Liquidación de ${periodoEnFrase(periodo)}` : "Liquidación" };
}

export default async function PaginaLiquidacion({ params, searchParams }: PageProps<"/liquidaciones/[periodo]">) {
  const { periodo } = await params;
  const { id, publicada } = (await searchParams) as { id?: string; publicada?: string };
  if (!esPeriodo(periodo)) notFound();
  const datos = await verLiquidacion(periodo, id);
  if (!datos) notFound();
  return <VistaLiquidacion datos={datos} volver={{ href: "/liquidaciones/anteriores", texto: "Liquidaciones anteriores" }} publicada={!!publicada} />;
}
