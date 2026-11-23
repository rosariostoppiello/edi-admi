import { notFound, redirect } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { periodoEnFrase } from "@/dominio/liquidacion/periodo";
import { exigirUsuario } from "@/servidor/sesion";
import { obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { Estado } from "../../partes";
import { TituloConfeccion } from "./titulo-confeccion";

export default async function LayoutConfeccion({ children, params }: LayoutProps<"/liquidaciones/confeccion/[id]">) {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "liquidacion.confeccionar")) notFound();
  const { id } = await params;
  const liq = await obtenerBorrador(id);
  if (!liq) notFound();
  if (liq.estado !== "BORRADOR") redirect(`/liquidaciones/${liq.periodo}`);

  return (
    <>
      <TituloConfeccion
        id={id}
        liquidacion={`${liq.rectificaId ? "Corrección de la liquidación" : "Liquidación"} de ${periodoEnFrase(liq.periodo)}`}
        estado={<Estado estado="BORRADOR" />}
      />
      <p className="mt-1 text-pizarra-suave">Todo lo que cargues queda guardado. Las unidades no ven nada hasta que la publiques.</p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </>
  );
}
