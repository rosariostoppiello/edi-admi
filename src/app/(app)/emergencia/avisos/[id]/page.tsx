import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { mensajeGeneral, type TipoEmergencia } from "@/dominio/emergencias";
import { exigirPermiso } from "@/servidor/sesion";
import { obtenerEmergencia } from "@/servidor/emergencias";
import { IconoVolver } from "@/componentes/ui/iconos";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import {
  accionAvisarATodos,
  accionCerrar,
  accionReintentar,
} from "../../acciones";
import { BotonReintentar, FormAvisarTodos, FormCerrar } from "../partes";

export const metadata: Metadata = { title: "Aviso de emergencia" };

const hora = new Intl.DateTimeFormat("es-UY", {
  timeZone: "America/Montevideo",
  dateStyle: "short",
  timeStyle: "short",
});

export default async function PaginaAviso({
  params,
}: PageProps<"/emergencia/avisos/[id]">) {
  const usuario = await exigirPermiso("emergencia.ver");
  const e = await obtenerEmergencia((await params).id);
  if (!e) notFound();
  const gestiona = puede(usuario, "emergencia.gestionar");
  const activa = e.estado === "ACTIVA";

  return (
    <>
      <Link
        href="/emergencia/avisos"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce-texto"
      >
        <IconoVolver className="size-5" />
        Avisos de emergencia
      </Link>
      <h1
        className={`mt-4 text-grande font-bold ${activa ? "text-alerta" : ""}`}
      >
        {e.nombreTipo}
      </h1>
      <p className="mt-1 font-bold">{activa ? "Activa" : e.nombreEstado}</p>

      <dl className="mt-5 grid max-w-2xl gap-x-6 gap-y-2 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 sm:grid-cols-[auto_1fr] md:p-6">
        <dt className="font-bold">Cuándo</dt>
        <dd>{hora.format(e.creadaEn)}</dd>
        <dt className="font-bold">Avisó</dt>
        <dd>
          {e.quien}
          {e.codigo ? (
            <span className="font-mono"> · {e.codigo}</span>
          ) : (
            ` · ${e.rolAutor}`
          )}
        </dd>
        <dt className="font-bold">Dónde</dt>
        <dd>{e.lugar || "No lo indicó"}</dd>
        {e.detalle && (
          <>
            <dt className="font-bold">Detalle</dt>
            <dd className="whitespace-pre-line">{e.detalle}</dd>
          </>
        )}
        {e.difundidaEn && (
          <>
            <dt className="font-bold">Aviso a todos</dt>
            <dd>
              {hora.format(e.difundidaEn)}, por {e.difundidaPor?.name}: “
              {e.mensajeGeneral}”
            </dd>
          </>
        )}
        {e.cerradaEn && (
          <>
            <dt className="font-bold">Cerrado</dt>
            <dd>
              {hora.format(e.cerradaEn)}, por {e.cerradaPor?.name}
              {e.nota && `: ${e.nota}`}
            </dd>
          </>
        )}
        {(e.envio.ENVIADO || e.envio.ERROR || e.envio.PENDIENTE) && (
          <>
            <dt className="font-bold">Mails</dt>
            <dd>
              {e.envio.ENVIADO ?? 0} enviados
              {e.envio.ERROR ? `, ${e.envio.ERROR} con error` : ""}
              {e.envio.PENDIENTE ? `, ${e.envio.PENDIENTE} pendientes` : ""}
            </dd>
          </>
        )}
      </dl>

      <div className="mt-6 flex max-w-2xl flex-col">
        <ZonaAvisos>
          {gestiona && (e.envio.ERROR || e.envio.PENDIENTE) ? (
            <div className="mt-4 max-w-2xl">
              <BotonReintentar accion={accionReintentar.bind(null, e.id)} />
            </div>
          ) : null}

          {gestiona && activa && !e.difundidaEn && (
            <section
              aria-labelledby="todos"
              className="mt-6 flex max-w-2xl flex-col gap-3 rounded-[var(--radius-tecla)] border-2 border-alerta bg-losa p-4 md:p-6"
            >
              <h2 id="todos" className="text-titulo font-bold">
                Avisar a todas las unidades
              </h2>
              <p>
                Primero comprobá que es real. Les llega un mail a todas las
                unidades y lo ven en el sistema hasta que cierres el aviso.
              </p>
              <FormAvisarTodos
                accion={accionAvisarATodos.bind(null, e.id)}
                mensaje={mensajeGeneral(e.tipo as TipoEmergencia, e.lugar)}
              />
            </section>
          )}

          {gestiona && activa && (
            <section
              aria-labelledby="cerrar"
              className="mt-6 flex max-w-2xl flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6"
            >
              <h2 id="cerrar" className="text-titulo font-bold">
                Cerrar el aviso
              </h2>
              <FormCerrar accion={accionCerrar.bind(null, e.id)} />
            </section>
          )}
        </ZonaAvisos>
      </div>
    </>
  );
}
