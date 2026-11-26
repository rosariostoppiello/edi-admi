import type { Metadata } from "next";
import Link from "next/link";
import { listarEmergencias } from "@/servidor/emergencias";
import { IconoVolver } from "@/componentes/ui/iconos";

export const metadata: Metadata = { title: "Avisos de emergencia" };

const hora = new Intl.DateTimeFormat("es-UY", {
  timeZone: "America/Montevideo",
  dateStyle: "short",
  timeStyle: "short",
});

/** Avisos de emergencia: los activos arriba. Portería, Administración y Comisión. */
export default async function PaginaAvisos() {
  const todas = await listarEmergencias();
  const activas = todas.filter((e) => e.estado === "ACTIVA");
  const cerradas = todas.filter((e) => e.estado !== "ACTIVA");

  return (
    <>
      <Link
        href="/emergencia"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce-texto"
      >
        <IconoVolver className="size-5" />
        Emergencia
      </Link>
      <h1 className="mt-4 text-grande font-bold">Avisos de emergencia</h1>

      <section
        aria-labelledby="activas"
        className="mt-6 flex max-w-2xl flex-col gap-3"
      >
        <h2 id="activas" className="text-titulo font-bold">
          Activos
        </h2>
        {activas.length === 0 ? (
          <p className="text-pizarra-suave">No hay emergencias activas.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/emergencia/avisos/${e.id}`}
                  className="flex flex-col gap-1 rounded-[var(--radius-tecla)] border-2 border-alerta bg-alerta-fondo p-4 hover:brightness-95"
                >
                  <span className="text-medio font-bold text-alerta">
                    {e.nombreTipo}
                    {e.lugar && ` · ${e.lugar}`}
                  </span>
                  <span>
                    {hora.format(e.creadaEn)} · Avisó {e.quien}
                    {e.codigo ? ` (${e.codigo})` : ` (${e.rolAutor})`}
                  </span>
                  <span className="text-chico font-bold">
                    {e.difundidaEn
                      ? "Ya se avisó a todas las unidades"
                      : "Todavía no se avisó a las unidades"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="anteriores"
        className="mt-8 flex max-w-2xl flex-col gap-3"
      >
        <h2 id="anteriores" className="text-titulo font-bold">
          Anteriores
        </h2>
        {cerradas.length === 0 ? (
          <p className="text-pizarra-suave">Todavía no hay avisos cerrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-junta rounded-[var(--radius-tecla)] border border-junta bg-losa">
            {cerradas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/emergencia/avisos/${e.id}`}
                  className="flex min-h-14 flex-col gap-0.5 px-4 py-3 hover:bg-granito"
                >
                  <span className="font-bold">
                    {e.nombreTipo}
                    {e.lugar && ` · ${e.lugar}`}
                  </span>
                  <span className="text-chico text-pizarra-suave">
                    {hora.format(e.creadaEn)} · {e.nombreEstado}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
