import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pesos } from "@/componentes/ui/monto";
import { puede } from "@/dominio/permisos";
import { DATOS_TURNO, esFecha, fechaEnFrase, leerReglas, limiteCancelacion, type Turno } from "@/dominio/reservas";
import { nombreMes } from "@/dominio/liquidacion/periodo";
import { codigosParaReservar, obtenerEspacio } from "@/servidor/reservas";
import { exigirPermiso } from "@/servidor/sesion";
import { unidadActiva } from "@/servidor/unidad-activa";
import { codigoDePersona } from "@/lib/edificio";
import { accionReservar } from "../../acciones";
import { Encabezado } from "../../encabezado";
import { FormReservar } from "../../partes";

export const metadata: Metadata = { title: "Reservar barbacoa" };

const horaUy = (d: Date) =>
  new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

/** Confirmación de la reserva: qué, cuándo, cuánto cuesta y hasta cuándo se cancela. */
export default async function PaginaReservar({ searchParams }: PageProps<"/reservas/barbacoas/reservar">) {
  const usuario = await exigirPermiso("reserva.ver");
  const sp = await searchParams;
  const fecha = typeof sp.fecha === "string" && esFecha(sp.fecha) ? sp.fecha : null;
  const turno = sp.turno === "MEDIODIA" || sp.turno === "NOCHE" ? (sp.turno as Turno) : null;
  const espacio = typeof sp.espacio === "string" ? await obtenerEspacio(sp.espacio) : null;
  if (!fecha || !turno || !espacio || espacio.tipo !== "BARBACOA" || !espacio.activo) notFound();

  const veQuien = puede(usuario, "reserva.verQuien");
  const propia = veQuien ? null : await unidadActiva(usuario);
  const codigos = await codigosParaReservar();
  const reglas = leerReglas(espacio.reglas);
  const datos = DATOS_TURNO[turno];
  const limite = limiteCancelacion(fecha, turno, reglas);

  return (
    <>
      <Encabezado titulo="Reservar barbacoa" volver={{ href: `/reservas/barbacoas?desde=${fecha}`, texto: "Barbacoas" }} />
      <div className="mt-6 flex max-w-2xl flex-col gap-5 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-chico text-pizarra-suave">Barbacoa</dt>
            <dd className="text-medio font-bold">{espacio.nombre}</dd>
          </div>
          <div>
            <dt className="text-chico text-pizarra-suave">Día y turno</dt>
            <dd className="text-medio font-bold first-letter:uppercase">
              {fechaEnFrase(fecha)}, {datos.nombre.toLowerCase()} ({datos.horario})
            </dd>
          </div>
          {propia && (
            <div>
              <dt className="text-chico text-pizarra-suave">Se cobra a</dt>
              <dd className="font-mono text-medio font-bold">{codigoDePersona(propia)}</dd>
            </div>
          )}
          {espacio.tarifa > 0 && (
            <div>
              <dt className="text-chico text-pizarra-suave">Costo</dt>
              <dd className="text-medio font-bold">
                {pesos(espacio.tarifa)} <span className="text-base font-normal text-pizarra-suave">en la liquidación de {nombreMes(fecha.slice(0, 7))}</span>
              </dd>
            </div>
          )}
        </dl>
        <p className="text-pizarra-suave">
          {limite > new Date()
            ? `Podés cancelarla hasta el ${horaUy(limite)} h (${reglas.horasCancelacion} horas antes). Después ya no se puede cancelar y se cobra igual.`
            : `Faltan menos de ${reglas.horasCancelacion} horas: esta reserva ya no se va a poder cancelar y se cobra igual.`}
        </p>
        <FormReservar
          accion={accionReservar}
          espacioId={espacio.id}
          fecha={fecha}
          turno={turno}
          codigos={codigos}
          pideCodigo={veQuien}
          pidePedidaPor={usuario.rol === "PORTERIA"}
        />
      </div>
    </>
  );
}
