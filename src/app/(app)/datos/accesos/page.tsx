import type { Metadata } from "next";
import { exigirPermiso } from "@/servidor/sesion";
import { listarPedidos } from "@/servidor/accesos";
import { Placa } from "@/componentes/ui/placa";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { Volver } from "../volver";
import { accionAprobarPedido, accionRechazarPedido } from "../acciones";
import { AccionesPedido } from "./partes";

export const metadata: Metadata = { title: "Pedidos de acceso" };

const fecha = new Intl.DateTimeFormat("es-UY", {
  timeZone: "America/Montevideo",
  dateStyle: "short",
  timeStyle: "short",
});
const ESTADO = {
  SIN_VERIFICAR: "Sin verificar",
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
} as const;

/** Pedidos de acceso de personas sin usuario (decisión 84). Solo Administración. */
export default async function PaginaAccesos() {
  await exigirPermiso("usuarios.administrar");
  const pedidos = await listarPedidos();
  const pendientes = pedidos.filter((p) => p.estado === "PENDIENTE");
  const resueltos = pedidos.filter((p) => p.estado !== "PENDIENTE");

  return (
    <>
      <Volver href="/datos/unidades" texto="Unidades" />
      <h1 className="mt-4 text-grande font-bold">Pedidos de acceso</h1>
      <p className="mt-1 max-w-prose text-pizarra-suave">
        Personas que pidieron su usuario desde la pantalla de ingreso. Antes de
        aprobar, comprobá que sean de esa unidad (por ejemplo, llamándolas).
      </p>

      <div className="mt-6 flex max-w-2xl flex-col gap-3">
        <ZonaAvisos>
          <section aria-labelledby="pendientes" className="flex flex-col gap-3">
            <h2 id="pendientes" className="text-titulo font-bold">
              Pendientes
            </h2>
            {pendientes.length === 0 ? (
              <p className="text-pizarra-suave">No hay pedidos pendientes.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {pendientes.map((p) => (
                  <li key={p.id} id={p.id}>
                    <article
                      aria-label={`Pedido de ${p.nombre}`}
                      className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Placa codigo={p.unidadCodigo} />
                        <h3 className="text-medio font-bold">{p.nombre}</h3>
                      </div>
                      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                        <dt className="font-bold">Es</dt>
                        <dd>{p.nombreCalidad}</dd>
                        <dt className="font-bold">Mail</dt>
                        <dd className="break-all">{p.email}</dd>
                        <dt className="font-bold">Teléfono</dt>
                        <dd>
                          <a
                            href={`tel:${p.telefono.replace(/[^\d+]/g, "")}`}
                            className="underline underline-offset-4 hover:text-bronce"
                          >
                            {p.telefono}
                          </a>
                        </dd>
                        <dt className="font-bold">Pedido</dt>
                        <dd>{fecha.format(p.creadoEn)}</dd>
                        {p.mensaje && (
                          <>
                            <dt className="font-bold">Mensaje</dt>
                            <dd className="whitespace-pre-line">{p.mensaje}</dd>
                          </>
                        )}
                      </dl>
                      <AccionesPedido
                        aprobar={accionAprobarPedido.bind(null, p.id)}
                        rechazar={accionRechazarPedido.bind(null, p.id)}
                        efecto={p.efecto}
                      />
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ZonaAvisos>
      </div>

      {resueltos.length > 0 && (
        <section
          aria-labelledby="resueltos"
          className="mt-8 flex max-w-2xl flex-col gap-3"
        >
          <h2 id="resueltos" className="text-titulo font-bold">
            Resueltos
          </h2>
          <ul className="flex flex-col divide-y divide-junta rounded-[var(--radius-tecla)] border border-junta bg-losa">
            {resueltos.map((p) => (
              <li key={p.id} className="flex flex-col gap-0.5 px-4 py-3">
                <span className="font-bold">
                  {p.nombre} ·{" "}
                  <span className="font-mono">{p.unidadCodigo}</span>
                </span>
                <span className="text-chico text-pizarra-suave">
                  {ESTADO[p.estado]}
                  {p.resueltoEn && ` el ${fecha.format(p.resueltoEn)}`}
                  {p.resueltoPor && ` por ${p.resueltoPor.name}`}
                  {p.motivo && ` · ${p.motivo}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
