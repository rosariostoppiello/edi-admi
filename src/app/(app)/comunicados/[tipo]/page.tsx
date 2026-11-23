import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { IconoComunicados } from "@/componentes/ui/iconos";
import { puede } from "@/dominio/permisos";
import { tamanoLegible, tipoDeSlug } from "@/dominio/comunicados";
import { envioDe, listarComunicados } from "@/servidor/comunicados";
import { exigirPermiso } from "@/servidor/sesion";
import { Volver } from "../../datos/volver";
import { accionBaja, accionEditar, accionMover, accionPublicar, accionReintentar } from "../acciones";
import { BotonChico, DarDeBaja, FormDesplegable } from "../partes";

export async function generateMetadata({ params }: PageProps<"/comunicados/[tipo]">): Promise<Metadata> {
  return { title: tipoDeSlug((await params).tipo)?.nombre ?? "Comunicados" };
}

const fechaLarga = (d: Date) => new Intl.DateTimeFormat("es-UY", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d);
const hoyUy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date());

/** Avisos y actas por fecha (lo último arriba); reglamentos en el orden que elige Administración. */
export default async function PaginaTipo({ params }: PageProps<"/comunicados/[tipo]">) {
  const usuario = await exigirPermiso("comunicado.ver");
  const { tipo: slug } = await params;
  const t = tipoDeSlug(slug);
  if (!t) notFound();
  const lista = await listarComunicados(t.tipo);
  const admin = puede(usuario, "comunicado.publicar");
  const envios = admin ? await Promise.all(lista.map((c) => (c.enviadoPorMail ? envioDe(c.id) : null))) : [];
  const esReglamento = t.tipo === "REGLAMENTO";

  return (
    <>
      <Volver href="/comunicados" texto="Comunicados de la Administración" />
      <div className="mt-4 flex items-center gap-3">
        <IconoComunicados className="size-10 shrink-0 text-bronce" />
        <h1 className="text-grande font-bold">{t.nombre}</h1>
      </div>

      <ZonaAvisos>
        {admin && (
          <section aria-label={`Publicar ${t.singular === "acta" ? "un acta" : `un ${t.singular}`}`} className="mt-6 max-w-3xl">
            <FormDesplegable
              textoDesplegar={`Publicar ${t.singular === "acta" ? "un acta" : `un ${t.singular}`}`}
              enCaja
              accion={accionPublicar.bind(null, slug)}
              valores={{ fecha: hoyUy() }}
              conMail={!esReglamento}
              mailPorDefecto={t.mailPorDefecto}
              pdfObligatorio={esReglamento}
              textoBoton="Publicar"
            />
          </section>
        )}

        <section aria-label={t.nombre} className="mt-6 max-w-3xl">
          {lista.length === 0 ? (
            <p className="text-pizarra-suave">Todavía no hay {t.nombre.toLowerCase()} publicados.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {lista.map((c, i) => {
                const fecha = c.fecha.toISOString().slice(0, 10);
                const envio = envios[i];
                return (
                  <li key={c.id}>
                    <article aria-labelledby={`t-${c.id}`} className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          {!esReglamento && (
                            <p className="text-chico text-pizarra-suave">
                              <time dateTime={fecha}>{fechaLarga(c.fecha)}</time>
                            </p>
                          )}
                          <h2 id={`t-${c.id}`} className="text-medio font-bold leading-tight">
                            {c.titulo}
                          </h2>
                        </div>
                        {admin && esReglamento && (
                          <div className="flex shrink-0 gap-2">
                            {i > 0 && <BotonChico accion={accionMover.bind(null, c.id, "arriba")} texto="↑" etiqueta={`Subir ${c.titulo}`} />}
                            {i < lista.length - 1 && <BotonChico accion={accionMover.bind(null, c.id, "abajo")} texto="↓" etiqueta={`Bajar ${c.titulo}`} />}
                          </div>
                        )}
                      </div>
                      {c.cuerpo && <p className="max-w-prose whitespace-pre-line">{c.cuerpo}</p>}
                      {c.archivo && (
                        <a
                          href={`/api/comunicados/${c.id}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex min-h-11 items-center self-start font-bold underline underline-offset-4 hover:text-bronce"
                        >
                          Ver el PDF ({tamanoLegible(c.archivo.tamano)})
                        </a>
                      )}
                      {admin && (
                        <div className="flex flex-col gap-3 border-t border-junta pt-3">
                          {envio && (
                            <div className="flex flex-wrap items-center gap-3 text-chico text-pizarra-suave">
                              <span>
                                Enviado por mail a {envio.ENVIADO ?? 0}
                                {envio.ERROR ? `; ${envio.ERROR} con error` : ""}
                                {envio.PENDIENTE ? `; ${envio.PENDIENTE} pendientes` : ""}.
                              </span>
                              {(envio.ERROR || envio.PENDIENTE) && <BotonChico accion={accionReintentar.bind(null, c.id)} texto="Reintentar" etiqueta="Reintentar los mails" />}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3">
                            <FormDesplegable
                              textoDesplegar="Editar"
                              accion={accionEditar.bind(null, c.id)}
                              valores={{ titulo: c.titulo, fecha, cuerpo: c.cuerpo }}
                              conMail={false}
                              mailPorDefecto={false}
                              pdfObligatorio={false}
                              tienePdf={Boolean(c.archivo)}
                              textoBoton="Guardar cambios"
                            />
                            <DarDeBaja accion={accionBaja.bind(null, c.id)} titulo={c.titulo} />
                          </div>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </ZonaAvisos>
    </>
  );
}
