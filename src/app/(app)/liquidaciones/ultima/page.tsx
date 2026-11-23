import type { Metadata } from "next";
import { verUltima } from "@/servidor/liquidacion/consulta";
import { Volver } from "../../datos/volver";
import { VistaLiquidacion } from "../vista";

export const metadata: Metadata = { title: "Última liquidación" };

export default async function PaginaUltima({ searchParams }: PageProps<"/liquidaciones/ultima">) {
  const { publicada } = (await searchParams) as { publicada?: string };
  const datos = await verUltima();
  const volver = { href: "/liquidaciones/mensual", texto: "Liquidación mensual" };
  if (!datos) {
    return (
      <>
        <Volver {...volver} />
        <h1 className="mt-4 text-grande font-bold">Última liquidación</h1>
        <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
          <p className="font-bold">Todavía no hay liquidaciones publicadas.</p>
          <p className="mt-2 text-pizarra-suave">Cuando la Administración publique la del mes, te llega por mail y la vas a ver acá.</p>
        </div>
      </>
    );
  }
  return <VistaLiquidacion datos={datos} volver={volver} publicada={!!publicada} />;
}
