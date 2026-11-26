import type { Metadata } from "next";
import Link from "next/link";
import { Monto } from "@/componentes/ui/monto";
import { nombrePeriodo, periodoEnFrase } from "@/dominio/liquidacion/periodo";
import { listarLiquidaciones } from "@/servidor/liquidacion/consulta";
import { Volver } from "../../datos/volver";
import { EnlacePdf, Estado } from "../partes";

export const metadata: Metadata = { title: "Liquidaciones anteriores" };

/** Todas menos la última publicada, de la más nueva a la más vieja. Las anuladas, marcadas. */
export default async function PaginaAnteriores() {
  const todas = await listarLiquidaciones();
  const ultima = todas.find((l) => l.estado === "PUBLICADA");
  const anteriores = todas.filter((l) => l.id !== ultima?.id);

  return (
    <>
      <Volver href="/liquidaciones/mensual" texto="Liquidación mensual" />
      <h1 className="mt-4 text-grande font-bold">Liquidaciones anteriores</h1>
      {anteriores.length === 0 ? (
        <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
          <p className="font-bold">Todavía no hay liquidaciones anteriores.</p>
          <p className="mt-2 text-pizarra-suave">
            {ultima ? (
              <>
                La de {periodoEnFrase(ultima.periodo)} está en{" "}
                <Link href="/liquidaciones/ultima" className="underline underline-offset-4 hover:text-bronce-texto">
                  Última liquidación
                </Link>
                .
              </>
            ) : (
              "Cuando haya liquidaciones publicadas, las vas a ver acá."
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col divide-y divide-junta rounded-[var(--radius-tecla)] border border-junta bg-losa">
          {anteriores.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 p-4">
              <div className="min-w-0">
                <Link
                  href={`/liquidaciones/${l.periodo}${l.estado === "ANULADA" ? `?id=${l.id}` : ""}`}
                  className="inline-flex min-h-11 items-center text-medio font-bold underline-offset-4 hover:text-bronce-texto hover:underline"
                >
                  {nombrePeriodo(l.periodo)}
                </Link>
                {(l.estado === "ANULADA" || l.rectificaId) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Estado estado={l.estado} />
                    {l.rectificaId && l.estado === "PUBLICADA" && <span className="text-chico text-pizarra-suave">Rectificada</span>}
                  </div>
                )}
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
      )}
    </>
  );
}
