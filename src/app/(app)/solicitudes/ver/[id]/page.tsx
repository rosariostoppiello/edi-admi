import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { NOMBRE_CATEGORIA, categoriaDeSlug, CATEGORIAS_PUBLICAS } from "@/dominio/solicitudes";
import { obtenerSolicitud, whatsappAdministracion } from "@/servidor/solicitudes";
import { accionEstado, accionNota, accionResponder } from "../../acciones";
import { ChipEstado, Encabezado, fechaLarga } from "../../lista";
import { BotonWhatsapp, FormEstado, FormNota, FormResponder } from "../../partes";

export const metadata: Metadata = { title: "Solicitud" };

const hora = (d: Date) =>
  new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

const ORIGEN = {
  UNIDAD: "La hizo la unidad",
  PORTERIA_PROPIA: "La hizo Portería",
  PORTERIA_A_PEDIDO: "La cargó Portería a pedido de la unidad",
} as const;

/** Detalle de una solicitud con su historial. Administración responde, cambia el estado y anota. */
export default async function PaginaSolicitud({ params }: PageProps<"/solicitudes/ver/[id]">) {
  const { id } = await params;
  const s = await obtenerSolicitud(id);
  if (!s) notFound();
  const whatsapp = s.gestiona ? "" : await whatsappAdministracion();
  const slug = CATEGORIAS_PUBLICAS.find((c) => c.categoria === s.categoria)?.slug;
  const volver = s.gestiona
    ? { href: "/solicitudes/bandeja", texto: "Bandeja de solicitudes" }
    : slug
      ? { href: `/solicitudes/${slug}`, texto: categoriaDeSlug(slug)!.nombre }
      : { href: "/solicitudes", texto: "Solicitudes varias" };

  return (
    <>
      <Encabezado titulo={s.asunto} volver={volver} />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-pizarra-suave">
        <ChipEstado estado={s.estado} />
        <span>{NOMBRE_CATEGORIA[s.categoria]}</span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="historial" className="flex flex-col gap-3">
          <h2 id="historial" className="sr-only">
            Historial
          </h2>
          <ol className="flex flex-col gap-3">
            <li className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4">
              <p className="text-chico text-pizarra-suave">
                {hora(s.creadaEn)}, {ORIGEN[s.origen]}
                {s.codigo && (
                  <>
                    {" "}
                    <span className="font-mono font-bold text-pizarra">{s.codigo}</span>
                  </>
                )}
                {s.pedidaPor && ` (pidió ${s.pedidaPor})`}
                {s.gestiona && `. Autor: ${s.autor.name}`}
              </p>
              <p className="mt-2 whitespace-pre-line">{s.texto}</p>
              {s.fotoId && (
                <a href={`/api/solicitudes/${s.id}/foto`} target="_blank" rel="noopener" className="mt-3 block max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto privada servida con control de acceso */}
                  <img src={`/api/solicitudes/${s.id}/foto`} alt={`Foto adjunta: ${s.asunto}`} className="w-full rounded-[var(--radius-campo)] border border-junta" />
                </a>
              )}
            </li>
            {s.eventos.map((e) =>
              e.tipo === "CAMBIO_ESTADO" ? (
                <li key={e.id} className="px-4 text-chico text-pizarra-suave">
                  {hora(e.fecha)}: {e.texto}
                </li>
              ) : (
                <li
                  key={e.id}
                  className={`rounded-[var(--radius-tecla)] border p-4 ${e.tipo === "NOTA_INTERNA" ? "border-dashed border-junta-fuerte bg-granito" : "border-bronce bg-losa"}`}
                >
                  <p className="text-chico font-bold">
                    {e.tipo === "NOTA_INTERNA" ? "Nota interna" : "Respuesta de la Administración"}
                    <span className="font-normal text-pizarra-suave">, {hora(e.fecha)}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-line">{e.texto}</p>
                </li>
              ),
            )}
          </ol>
          {!s.gestiona && s.eventos.every((e) => e.tipo !== "RESPUESTA") && (
            <p className="text-pizarra-suave">Todavía no hay respuesta. Te avisamos por mail cuando la Administración responda.</p>
          )}
          {whatsapp && s.estado !== "RESUELTA" && <BotonWhatsapp numero={whatsapp} categoria={NOMBRE_CATEGORIA[s.categoria]} codigo={s.codigo} asunto={s.asunto} />}
          {s.gestiona && s.categoria === "VENTA_UNIDAD" && s.unidadId && (
            <Link href={`/datos/${s.unidadId}`} className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
              Ir a la ficha de la unidad para cambiar de propietario
            </Link>
          )}
        </section>

        {s.gestiona && (
          <aside aria-label="Gestión" className="flex flex-col gap-5 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
            <ZonaAvisos>
              <FormResponder accion={accionResponder.bind(null, s.id)} />
              <hr className="border-junta" />
              <FormEstado accion={accionEstado.bind(null, s.id)} actual={s.estado} />
              <hr className="border-junta" />
              <FormNota accion={accionNota.bind(null, s.id)} />
            </ZonaAvisos>
          </aside>
        )}
      </div>
      <p className="sr-only">Creada el {fechaLarga(s.creadaEn)}</p>
    </>
  );
}
