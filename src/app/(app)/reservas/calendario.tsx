import Link from "next/link";
import type { ReactNode } from "react";
import { DATOS_TURNO, TURNOS, diasDesde, fechaEnFrase, sumarDias, type Turno } from "@/dominio/reservas";

export const DIAS_POR_PAGINA = 7;

/** Primer día a mostrar: el pedido por la URL, entre hoy y el límite de anticipación. */
export function desdeValido(pedido: string | undefined, hoy: string, limite: string): string {
  if (!pedido || !/^\d{4}-\d{2}-\d{2}$/.test(pedido) || pedido < hoy) return hoy;
  return pedido > limite ? limite : pedido;
}

/** Navegación de a semanas, sin pasar de hoy ni del límite de anticipación. */
export function NavegarSemanas({ ruta, desde, hoy, limite }: { ruta: string; desde: string; hoy: string; limite: string }) {
  const anterior = sumarDias(desde, -DIAS_POR_PAGINA);
  const siguiente = sumarDias(desde, DIAS_POR_PAGINA);
  const clase = "inline-flex min-h-12 items-center rounded-[var(--radius-campo)] border-2 border-pizarra bg-losa px-4 font-bold hover:bg-granito";
  const inactivo = "inline-flex min-h-12 items-center rounded-[var(--radius-campo)] border-2 border-junta px-4 font-bold text-pizarra-suave";
  return (
    <nav aria-label="Cambiar de semana" className="flex flex-wrap items-center justify-between gap-3">
      {desde > hoy ? (
        <Link href={`${ruta}?desde=${anterior < hoy ? hoy : anterior}`} className={clase}>
          Semana anterior
        </Link>
      ) : (
        <span className={inactivo} aria-disabled="true">
          Semana anterior
        </span>
      )}
      {siguiente <= limite ? (
        <Link href={`${ruta}?desde=${siguiente}`} className={clase}>
          Semana siguiente
        </Link>
      ) : (
        <span className={inactivo} aria-disabled="true">
          Semana siguiente
        </span>
      )}
    </nav>
  );
}

export interface FilaCalendario {
  id: string;
  nombre: string;
  /** Contenido de la celda de cada turno. */
  celda: (fecha: string, turno: Turno) => ReactNode;
}

/**
 * Una tarjeta por día; adentro, una fila por espacio y una columna por turno.
 * En el celular las tarjetas van una debajo de otra; desde tablet, en grilla.
 */
export function Calendario({ desde, filas, etiqueta }: { desde: string; filas: FilaCalendario[]; etiqueta: string }) {
  return (
    <ol aria-label={etiqueta} className="grid gap-4 lg:grid-cols-2">
      {diasDesde(desde, DIAS_POR_PAGINA).map((fecha) => (
        <li key={fecha} className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4">
          <h3 className="text-medio font-bold first-letter:uppercase">{fechaEnFrase(fecha)}</h3>
          <table className="mt-3 w-full table-fixed border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-chico text-pizarra-suave">
                <th scope="col" className="w-[38%] font-normal">
                  <span className="sr-only">Espacio</span>
                </th>
                {TURNOS.map((t) => (
                  <th key={t} scope="col" className="px-1 font-normal">
                    <span className="font-bold text-pizarra">{DATOS_TURNO[t].nombre}</span>
                    <span className="block">{DATOS_TURNO[t].horario}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <th scope="row" className="pr-2 text-left align-middle font-bold leading-tight">
                    {f.nombre}
                  </th>
                  {TURNOS.map((t) => (
                    <td key={t} className="px-1 align-middle">
                      {f.celda(fecha, t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </li>
      ))}
    </ol>
  );
}

type Tono = "libre" | "propia" | "ocupada" | "nada";

const TONOS: Record<Tono, string> = {
  libre: "border-2 border-bronce bg-losa text-pizarra hover:bg-bronce hover:text-white",
  propia: "border-2 border-ok bg-ok-fondo text-ok",
  ocupada: "border border-junta bg-granito text-pizarra-suave",
  nada: "border border-dashed border-junta text-pizarra-suave",
};

const CLASE_CELDA = "flex min-h-12 w-full flex-col items-center justify-center rounded-[var(--radius-campo)] px-1 py-1 text-center text-chico font-bold leading-tight";

/** Celda de un turno: un enlace si se puede reservar, un texto si no. */
export function Celda({ tono, texto, detalle, href, etiqueta }: { tono: Tono; texto: string; detalle?: string; href?: string; etiqueta?: string }) {
  const contenido = (
    <>
      <span>{texto}</span>
      {detalle && <span className={/^\d+-/.test(detalle) ? "font-mono" : "font-normal"}>{detalle}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-label={etiqueta} className={`${CLASE_CELDA} ${TONOS[tono]}`}>
        {contenido}
      </Link>
    );
  }
  return (
    <span className={`${CLASE_CELDA} ${TONOS[tono]}`}>
      {etiqueta ? (
        <>
          <span className="sr-only">{etiqueta}</span>
          <span aria-hidden="true" className="contents">
            {contenido}
          </span>
        </>
      ) : (
        contenido
      )}
    </span>
  );
}
