import type { Metadata } from "next";
import Link from "next/link";
import { BotonEnlace } from "@/componentes/ui/boton";
import { Monto } from "@/componentes/ui/monto";
import { puede } from "@/dominio/permisos";
import { nombreMes, nombrePeriodo, periodoEnFrase } from "@/dominio/liquidacion/periodo";
import { exigirUsuario } from "@/servidor/sesion";
import { listarLiquidaciones } from "@/servidor/liquidacion/consulta";
import { borradorActual, proximoPeriodo } from "@/servidor/liquidacion/confeccion";
import { Volver } from "../datos/volver";
import { EnlacePdf, Estado } from "./partes";

export const metadata: Metadata = { title: "Liquidación de gastos comunes" };

export default async function PaginaLiquidaciones() {
  const usuario = await exigirUsuario();
  const liquidaciones = await listarLiquidaciones();
  const confecciona = puede(usuario, "liquidacion.confeccionar");
  const borrador = confecciona ? await borradorActual() : null;
  const proximo = confecciona && !borrador ? await proximoPeriodo() : null;
  const ultima = liquidaciones.find((l) => l.estado === "PUBLICADA");

  return (
    <>
      <Volver />
      <h1 className="mt-4 text-grande font-bold">Liquidación de gastos comunes</h1>

      {confecciona && (
        <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-tecla)] border-2 border-bronce bg-losa p-4 md:p-6">
          <div>
            <h2 className="text-medio font-bold">Confección</h2>
            <p className="text-pizarra-suave">
              {borrador
                ? `La liquidación de ${nombreMes(borrador.periodo)} está en preparación.`
                : proximo
                  ? `Toca preparar la liquidación de ${nombreMes(proximo)}.`
                  : "Todavía no hay liquidaciones. Prepará la primera."}
            </p>
          </div>
          <BotonEnlace href={borrador ? `/liquidaciones/confeccion/${borrador.id}/ingresos` : "/liquidaciones/confeccion"}>
            {borrador ? `Seguir con ${nombreMes(borrador.periodo)}` : proximo ? `Preparar ${nombreMes(proximo)}` : "Preparar la primera"}
          </BotonEnlace>
        </section>
      )}

      {liquidaciones.length === 0 ? (
        <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
          <p className="font-bold">Todavía no hay liquidaciones publicadas.</p>
          <p className="mt-2 text-pizarra-suave">Cuando la administración publique la del mes, te llega por mail y la vas a ver acá.</p>
        </div>
      ) : (
        <>
          {ultima && ultima.propias.length > 0 && (
            <p className="mt-5">
              <Link href={`/liquidaciones/${ultima.periodo}`} className="text-medio font-bold underline underline-offset-4 hover:text-bronce">
                Ver tu liquidación de {nombreMes(ultima.periodo)}
              </Link>
            </p>
          )}
          <h2 className="mt-8 text-titulo font-bold">Meses publicados</h2>
          <ul className="mt-3 flex flex-col divide-y divide-junta rounded-[var(--radius-tecla)] border border-junta bg-losa">
            {liquidaciones.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/liquidaciones/${l.periodo}${l.estado === "ANULADA" ? `?id=${l.id}` : ""}`}
                    className="text-medio font-bold underline-offset-4 hover:text-bronce hover:underline"
                  >
                    {nombrePeriodo(l.periodo)}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {(l.estado === "ANULADA" || l.rectificaId) && <Estado estado={l.estado} />}
                    {l.rectificaId && l.estado === "PUBLICADA" && <span className="text-chico text-pizarra-suave">Rectificada</span>}
                  </div>
                  {l.propias.length > 0 && (
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {l.propias.map((p) => (
                        <li key={p.codigo} className="text-pizarra-suave">
                          <span className="font-mono font-bold text-pizarra">{p.codigo}</span>{" "}
                          {p.saldoAPagar < 0 ? "a favor " : "a pagar "}
                          <Monto valor={Math.abs(p.saldoAPagar)} conSimbolo className="font-bold text-pizarra" />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {l.estado === "PUBLICADA" && <EnlacePdf id={l.id} texto="PDF" detalle={`de ${periodoEnFrase(l.periodo)}`} />}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
