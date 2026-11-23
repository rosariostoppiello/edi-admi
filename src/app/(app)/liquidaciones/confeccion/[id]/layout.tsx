import { notFound, redirect } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { periodoEnFrase } from "@/dominio/liquidacion/periodo";
import { exigirUsuario } from "@/servidor/sesion";
import { obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { Estado } from "../../partes";
import { VolverConfeccion } from "./volver-confeccion";

export default async function LayoutConfeccion({ children, params }: LayoutProps<"/liquidaciones/confeccion/[id]">) {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "liquidacion.confeccionar")) notFound();
  const { id } = await params;
  const liq = await obtenerBorrador(id);
  if (!liq) notFound();
  if (liq.estado !== "BORRADOR") redirect(`/liquidaciones/${liq.periodo}`);

  return (
    <>
      <VolverConfeccion id={id} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-grande font-bold">
          {liq.rectificaId ? "Corrección de la liquidación" : "Liquidación"} de {periodoEnFrase(liq.periodo)}
        </h1>
        <Estado estado="BORRADOR" />
      </div>
      <p className="mt-1 text-pizarra-suave">Todo lo que cargues queda guardado. Las unidades no ven nada hasta que la publiques.</p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </>
  );
}
