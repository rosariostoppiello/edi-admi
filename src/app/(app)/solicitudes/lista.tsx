import Link from "next/link";
import { NOMBRE_CATEGORIA, NOMBRE_ESTADO, type EstadoSolicitud } from "@/dominio/solicitudes";
import type { SolicitudResumida } from "@/servidor/solicitudes";
import { IconoSolicitudes } from "@/componentes/ui/iconos";
import { Volver } from "../datos/volver";

const fecha = (d: Date) => new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", day: "numeric", month: "long", year: "numeric" }).format(d);

const CLASE_ESTADO: Record<EstadoSolicitud, string> = {
  NUEVA: "border-bronce bg-bronce-claro text-pizarra",
  EN_CURSO: "border-junta-fuerte bg-granito text-pizarra",
  RESUELTA: "border-ok bg-ok-fondo text-ok",
};

export function ChipEstado({ estado }: { estado: EstadoSolicitud }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-chico font-bold ${CLASE_ESTADO[estado]}`}>{NOMBRE_ESTADO[estado]}</span>;
}

export function Encabezado({ titulo, volver = { href: "/solicitudes", texto: "Solicitudes varias" } }: { titulo: string; volver?: { href: string; texto: string } }) {
  return (
    <>
      <Volver href={volver.href} texto={volver.texto} />
      <div className="mt-4 flex items-center gap-3">
        <IconoSolicitudes className="size-10 shrink-0 text-bronce" />
        <h1 className="text-grande font-bold">{titulo}</h1>
      </div>
    </>
  );
}

const ORIGEN = { UNIDAD: null, PORTERIA_PROPIA: "Portería", PORTERIA_A_PEDIDO: "Portería a pedido" } as const;

/** Lista de solicitudes: cada una es un enlace a su detalle con el historial. */
export function ListaSolicitudes({ solicitudes, conUnidad = false, conCategoria = false }: { solicitudes: SolicitudResumida[]; conUnidad?: boolean; conCategoria?: boolean }) {
  return (
    <ul className="flex flex-col gap-3">
      {solicitudes.map((s) => (
        <li key={s.id}>
          <Link
            href={`/solicitudes/ver/${s.id}`}
            className="flex flex-col gap-1 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 hover:border-bronce"
          >
            <span className="flex flex-wrap items-center gap-2">
              <ChipEstado estado={s.estado} />
              {conCategoria && <span className="text-chico font-bold text-pizarra-suave">{NOMBRE_CATEGORIA[s.categoria]}</span>}
            </span>
            <span className="text-medio font-bold leading-tight">{s.asunto}</span>
            <span className="text-chico text-pizarra-suave">
              {fecha(s.creadaEn)}
              {conUnidad && (
                <>
                  {", "}
                  {s.codigo ? <span className="font-mono font-bold text-pizarra">{s.codigo}</span> : "sin unidad"}
                  {", "}
                  {ORIGEN[s.origen] ?? s.autor}
                  {s.pedidaPor && ` (pidió ${s.pedidaPor})`}
                </>
              )}
              {s.respuestas > 0 && `, ${s.respuestas} ${s.respuestas === 1 ? "respuesta" : "respuestas"}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export { fecha as fechaLarga };
