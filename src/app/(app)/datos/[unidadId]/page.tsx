import type { Metadata } from "next";
import { Aviso } from "@/componentes/ui/aviso";
import { Ficha } from "../ficha";
import { Volver } from "../volver";

export const metadata: Metadata = { title: "Datos de la unidad" };

export default async function PaginaFichaUnidad({
  params,
  searchParams,
}: {
  params: Promise<{ unidadId: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const { unidadId } = await params;
  const { creada } = await searchParams;
  return (
    <>
      <Volver href="/datos/unidades" texto="Todas las unidades" />
      <div className="mt-4 flex flex-col gap-4">
        {creada && <Aviso tono="ok">Unidad creada. Le mandamos al responsable un mail para que cree su contraseña.</Aviso>}
        <Ficha unidadId={unidadId} />
      </div>
    </>
  );
}
