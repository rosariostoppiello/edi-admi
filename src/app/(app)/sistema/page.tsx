import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listarEdificiosDelSistema } from "@/servidor/alta-edificios";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { IconoVolver } from "@/componentes/ui/iconos";
import { accionAprobarEdificio, accionRechazarEdificio } from "../edificios/acciones";
import { RevisarEdificio } from "../edificios/partes";

export const metadata: Metadata = { title: "Edificios del sistema" };

const fecha = new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", dateStyle: "short" });
const ESTADO = { PENDIENTE: "Pendiente", ACTIVO: "Activo", RECHAZADO: "Rechazado", BAJA: "De baja" } as const;

/** Solo el dueño del sistema: revisa los pedidos de alta de edificios (decisión 86). */
export default async function PaginaSistema() {
  const edificios = await listarEdificiosDelSistema();
  if (!edificios) notFound();
  const pendientes = edificios.filter((e) => e.estado === "PENDIENTE");
  const otros = edificios.filter((e) => e.estado !== "PENDIENTE");

  return (
    <>
      <Link href="/inicio" className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce">
        <IconoVolver className="size-5" />
        Inicio
      </Link>
      <h1 className="mt-4 text-grande font-bold">Edificios del sistema</h1>

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        <ZonaAvisos>
          <section aria-labelledby="pendientes" className="flex flex-col gap-3">
            <h2 id="pendientes" className="text-titulo font-bold">
              Pedidos de alta
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-pizarra-suave">No hay pedidos pendientes.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {pendientes.map((e) => (
                  <li key={e.id}>
                    <article aria-label={`Pedido de ${e.nombre}`} className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
                      <h3 className="text-medio font-bold">{e.nombre}</h3>
                      <p>
                        {e.direccion || "Sin dirección"} · {e._count.torres} {e._count.torres === 1 ? "torre" : "torres"}
                      </p>
                      <p className="text-chico text-pizarra-suave">
                        Lo pidió {e.solicitadoPor?.name ?? "—"} ({e.solicitadoPor?.email}) el {fecha.format(e.creadoEn)}
                      </p>
                      <RevisarEdificio aprobar={accionAprobarEdificio.bind(null, e.id)} rechazar={accionRechazarEdificio.bind(null, e.id)} />
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ZonaAvisos>
      </div>

      <section aria-labelledby="todos" className="mt-8 flex max-w-2xl flex-col gap-3">
        <h2 id="todos" className="text-titulo font-bold">
          Todos los edificios
        </h2>
        <ul className="flex flex-col divide-y divide-junta rounded-[var(--radius-tecla)] border border-junta bg-losa">
          {otros.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3">
              <span className="font-bold">{e.nombre}</span>
              <span className="text-chico text-pizarra-suave">
                {ESTADO[e.estado]} · {e._count.unidades} unidades{e.motivoRechazo ? ` · ${e.motivoRechazo}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
