import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { NOMBRE_CATEGORIA, NOMBRE_ESTADO, type Categoria, type EstadoSolicitud } from "@/dominio/solicitudes";
import { exigirUsuario } from "@/servidor/sesion";
import { bandeja, whatsappAdministracion } from "@/servidor/solicitudes";
import { Seccion } from "../../liquidaciones/partes";
import { accionWhatsapp } from "../acciones";
import { Encabezado, ListaSolicitudes } from "../lista";
import { FormWhatsapp } from "../partes";

export const metadata: Metadata = { title: "Bandeja de solicitudes" };

const CATEGORIAS = Object.keys(NOMBRE_CATEGORIA) as Categoria[];
const ESTADOS = Object.keys(NOMBRE_ESTADO) as EstadoSolicitud[];

function Filtro<T extends string>({ etiqueta, nombre, opciones, actual, otros, textos }: { etiqueta: string; nombre: string; opciones: T[]; actual?: T; otros: Record<string, string | undefined>; textos: Record<T, string> }) {
  const href = (v?: T) => {
    const q = new URLSearchParams(Object.entries({ ...otros, [nombre]: v }).filter((e): e is [string, string] => Boolean(e[1])));
    return `/solicitudes/bandeja${q.size ? `?${q}` : ""}`;
  };
  const clase = (activo: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border-2 px-4 text-chico font-bold ${activo ? "border-cabecera bg-cabecera text-white" : "border-junta-fuerte bg-losa hover:border-bronce"}`;
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-2">
      <Link href={href()} className={clase(!actual)} aria-current={!actual ? "page" : undefined}>
        Todas
      </Link>
      {opciones.map((o) => (
        <Link key={o} href={href(o)} className={clase(actual === o)} aria-current={actual === o ? "page" : undefined}>
          {textos[o]}
        </Link>
      ))}
    </nav>
  );
}

/** Administración (gestiona) y Comisión (lee): todas las solicitudes con filtros por categoría y estado. */
export default async function PaginaBandeja({ searchParams }: PageProps<"/solicitudes/bandeja">) {
  const usuario = await exigirUsuario();
  if (!puede(usuario, "solicitud.verTodas")) notFound();
  const sp = await searchParams;
  const categoria = CATEGORIAS.find((c) => c === sp.categoria);
  const estado = ESTADOS.find((e) => e === sp.estado);
  const [lista, whatsapp] = await Promise.all([bandeja({ categoria, estado }), whatsappAdministracion()]);

  return (
    <>
      <Encabezado titulo="Bandeja de solicitudes" />
      <div className="mt-6 flex flex-col gap-3">
        <Filtro etiqueta="Filtrar por categoría" nombre="categoria" opciones={CATEGORIAS} actual={categoria} otros={{ estado }} textos={NOMBRE_CATEGORIA} />
        <Filtro etiqueta="Filtrar por estado" nombre="estado" opciones={ESTADOS} actual={estado} otros={{ categoria }} textos={NOMBRE_ESTADO} />
      </div>
      <section aria-label="Solicitudes" className="mt-6 max-w-3xl">
        {lista.length === 0 ? <p className="text-pizarra-suave">No hay solicitudes con este filtro.</p> : <ListaSolicitudes solicitudes={lista} conUnidad conCategoria />}
      </section>
      {puede(usuario, "solicitud.gestionar") && (
        <div className="mt-8 max-w-3xl">
          <Seccion titulo="WhatsApp de la Administración">
            <p className="text-pizarra-suave">Con este número, las unidades ven el botón &quot;Escribir por WhatsApp&quot; con el mensaje ya armado.</p>
            <FormWhatsapp accion={accionWhatsapp} actual={whatsapp} />
          </Seccion>
        </div>
      )}
    </>
  );
}
