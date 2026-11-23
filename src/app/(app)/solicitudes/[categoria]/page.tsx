import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { categoriaDeSlug } from "@/dominio/solicitudes";
import { exigirUsuario } from "@/servidor/sesion";
import { misSolicitudes, whatsappAdministracion } from "@/servidor/solicitudes";
import { unidadActiva } from "@/servidor/unidad-activa";
import { codigoBase } from "@/dominio/codigos";
import { accionCrear } from "../acciones";
import { Encabezado, ListaSolicitudes } from "../lista";
import { FormSolicitud } from "../partes";

const AYUDA = {
  desperfectos: "Dónde es (torre, piso, espacio común) y qué se rompió.",
  consultas: "Tu consulta sobre la liquidación, pagos o saldos.",
  inquietudes: "Lo que nos quieras plantear.",
} as const;

export async function generateMetadata({ params }: PageProps<"/solicitudes/[categoria]">): Promise<Metadata> {
  return { title: categoriaDeSlug((await params).categoria)?.nombre ?? "Solicitudes" };
}

/** Formulario de la categoría y, abajo, "Mis solicitudes" con su estado y las respuestas. */
export default async function PaginaCategoria({ params }: PageProps<"/solicitudes/[categoria]">) {
  const usuario = await exigirUsuario();
  const { categoria: slug } = await params;
  const cat = categoriaDeSlug(slug);
  if (!cat) notFound();

  const esPorteria = usuario.rol === "PORTERIA";
  const unidad = esPorteria ? null : await unidadActiva(usuario);
  // Administración y la Comisión sin unidad no crean solicitudes: las ven en la bandeja.
  if (!esPorteria && !unidad) {
    if (puede(usuario, "solicitud.verTodas")) redirect(`/solicitudes/bandeja?categoria=${cat.categoria}`);
    notFound();
  }
  const [mias, whatsapp] = await Promise.all([misSolicitudes(cat.categoria), whatsappAdministracion()]);
  const codigo = unidad ? codigoBase(unidad.torre, unidad.numero) : null;

  return (
    <>
      <Encabezado titulo={cat.nombre} />
      <section aria-labelledby="nueva" className="mt-6 flex max-w-2xl flex-col gap-4 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <h2 id="nueva" className="text-titulo font-bold">
          Nueva solicitud
        </h2>
        {codigo && <p className="text-pizarra-suave">Va a nombre de la unidad <span className="font-mono font-bold text-pizarra">{codigo}</span>.</p>}
        <FormSolicitud
          accion={accionCrear.bind(null, slug)}
          categoria={cat.corto}
          esPorteria={esPorteria}
          codigo={codigo}
          whatsapp={whatsapp}
          ayudaTexto={AYUDA[cat.slug]}
        />
      </section>
      <section aria-labelledby="mias" className="mt-8 flex max-w-2xl flex-col gap-3">
        <h2 id="mias" className="text-titulo font-bold">
          Mis solicitudes
        </h2>
        {mias.length === 0 ? <p className="text-pizarra-suave">Todavía no hiciste solicitudes de este tipo.</p> : <ListaSolicitudes solicitudes={mias} conUnidad={esPorteria} />}
      </section>
    </>
  );
}
