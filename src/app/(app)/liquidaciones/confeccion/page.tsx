import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { periodoEnFrase, periodoDe } from "@/dominio/liquidacion/periodo";
import { exigirUsuario } from "@/servidor/sesion";
import { borradorActual, proximoPeriodo } from "@/servidor/liquidacion/confeccion";
import { Volver } from "../../datos/volver";
import { accionCrear } from "../acciones";
import { FormCrear } from "./crear";

export const metadata: Metadata = { title: "Confección de la liquidación" };

export default async function PaginaConfeccion() {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "liquidacion.confeccionar")) notFound();
  const borrador = await borradorActual();
  if (borrador) redirect(`/liquidaciones/confeccion/${borrador.id}`);
  const proximo = await proximoPeriodo();
  const hoy = new Date();
  const sugerido = periodoDe(hoy.getFullYear(), hoy.getMonth() + 1);

  return (
    <>
      <Volver href="/liquidaciones" texto="Liquidación de gastos comunes" />
      <h1 className="mt-4 text-grande font-bold">
        {proximo ? `Preparar la liquidación de ${periodoEnFrase(proximo)}` : "Preparar la primera liquidación"}
      </h1>
      <div className="mt-4 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <p className="text-pizarra-suave">
          {proximo
            ? "Se crea un borrador con los egresos fijos precargados y los saldos del mes anterior. Nada se publica hasta que lo confirmes."
            : "Como es la primera, vas a cargar los saldos anteriores de cada unidad desde una planilla. Las siguientes toman el saldo del mes anterior."}
        </p>
        <div className="mt-5">
          <FormCrear accion={accionCrear} pedirPeriodo={!proximo} periodoSugerido={sugerido} />
        </div>
      </div>
    </>
  );
}
