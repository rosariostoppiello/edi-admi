import type { Metadata } from "next";
import { Aviso } from "@/componentes/ui/aviso";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { pesos } from "@/componentes/ui/monto";
import { puede } from "@/dominio/permisos";
import { DATOS_TURNO, REGLAS_POR_DEFECTO, fechaEnFrase, fechaUy, inicioTurno, leerReglas, sumarDias } from "@/dominio/reservas";
import { listarEspacios, ocupacion, proximasReservas } from "@/servidor/reservas";
import { exigirPermiso } from "@/servidor/sesion";
import { accionCancelar } from "../acciones";
import { Calendario, Celda, DIAS_POR_PAGINA, NavegarSemanas, desdeValido } from "../calendario";
import { Encabezado } from "../encabezado";
import { CancelarReserva } from "../partes";

export const metadata: Metadata = { title: "Barbacoas" };

const ORIGEN = { UNIDAD: "La reservó la unidad", PORTERIA_A_PEDIDO: "La cargó Portería", ADMINISTRACION: "La cargó la Administración" } as const;

export default async function PaginaBarbacoas({ searchParams }: PageProps<"/reservas/barbacoas">) {
  const usuario = await exigirPermiso("reserva.ver");
  const sp = await searchParams;
  const barbacoas = await listarEspacios("BARBACOA");
  const ahora = new Date();
  const hoy = fechaUy(ahora);
  const anticipacion = Math.max(...barbacoas.map((b) => leerReglas(b.reglas).anticipacionDias), REGLAS_POR_DEFECTO.anticipacionDias);
  const limite = sumarDias(hoy, anticipacion);
  const desde = desdeValido(typeof sp.desde === "string" ? sp.desde : undefined, hoy, limite);
  const hasta = sumarDias(desde, DIAS_POR_PAGINA - 1);
  const [ocupados, proximas] = await Promise.all([ocupacion(desde, hasta), proximasReservas()]);
  const veQuien = puede(usuario, "reserva.verQuien");
  const puedeReservar = veQuien || usuario.unidades.length > 0;
  const tarifas = [...new Set(barbacoas.map((b) => b.tarifa))];
  const reglas = leerReglas(barbacoas[0]?.reglas);

  return (
    <>
      <Encabezado titulo="Barbacoas" />
      <div className="mt-3 flex max-w-prose flex-col gap-1 text-pizarra-suave">
        <p>
          Dos turnos por día: mediodía de 11 a 17 h y noche de 19 a 2 h. Podés reservar hasta con {reglas.anticipacionDias} días de anticipación,
          tener hasta {reglas.maxActivasPorUnidad} reservas a la vez y cancelar hasta {reglas.horasCancelacion} horas antes del turno.
        </p>
        {tarifas.length === 1 && tarifas[0] > 0 && <p>El uso se cobra en la liquidación del mes: {pesos(tarifas[0])} por turno.</p>}
      </div>

      {sp.reservada && (
        <div className="mt-4">
          <Aviso tono="ok">Listo, la reserva quedó hecha. La ves en la lista de abajo.</Aviso>
        </div>
      )}

      <section aria-labelledby="proximas" className="mt-6 flex flex-col gap-3">
        <h2 id="proximas" className="text-titulo font-bold">
          {veQuien ? "Próximas reservas" : "Tus reservas"}
        </h2>
        <ZonaAvisos>
        {proximas.length === 0 ? (
          <p className="text-pizarra-suave">{veQuien ? "No hay reservas próximas." : "No tenés reservas. Elegí un turno libre en el calendario."}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {proximas.map((r) => {
              const descripcion = `${r.espacio} el ${fechaEnFrase(r.fecha)}, turno ${DATOS_TURNO[r.turno].nombre.toLowerCase()}`;
              return (
                <li key={r.id} className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4">
                  <div>
                    <p className="font-bold first-letter:uppercase">{fechaEnFrase(r.fecha)}</p>
                    <p>
                      {r.espacio} · {DATOS_TURNO[r.turno].nombre} ({DATOS_TURNO[r.turno].horario})
                    </p>
                    <p className="text-chico text-pizarra-suave">
                      <span className="font-mono font-bold text-pizarra">{r.codigo}</span> · {ORIGEN[r.origen]}
                      {r.pedidaPor && ` a pedido de ${r.pedidaPor}`}
                    </p>
                  </div>
                  {r.puedeCancelar ? (
                    <CancelarReserva accion={accionCancelar.bind(null, r.id)} descripcion={descripcion} fueraDePlazo={!r.enPlazo} />
                  ) : (
                    <p className="text-chico text-pizarra-suave">
                      {r.cobrada
                        ? "Ya está cargada en la liquidación."
                        : veQuien
                          ? `Ya no se puede cancelar: faltan menos de ${reglas.horasCancelacion} horas. Solo la Administración puede cancelarla.`
                          : `Ya no se puede cancelar: faltan menos de ${reglas.horasCancelacion} horas. Si no la vas a usar, avisale a la Administración.`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </ZonaAvisos>
      </section>
      <section aria-labelledby="disponibilidad" className="mt-8 flex flex-col gap-4">
        <h2 id="disponibilidad" className="text-titulo font-bold">
          Disponibilidad
        </h2>
        {barbacoas.length === 0 ? (
          <p className="text-pizarra-suave">No hay barbacoas habilitadas para reservar.</p>
        ) : (
          <>
            <NavegarSemanas ruta="/reservas/barbacoas" desde={desde} hoy={hoy} limite={limite} />
            <Calendario
              desde={desde}
              etiqueta="Disponibilidad de las barbacoas por día"
              filas={barbacoas.map((b) => ({
                id: b.id,
                nombre: b.nombre.replace(/^Barbacoa\s+/i, ""),
                celda: (fecha, turno) => {
                  const turnoTexto = `${b.nombre}, ${fechaEnFrase(fecha)}, ${DATOS_TURNO[turno].nombre.toLowerCase()}`;
                  const o = ocupados.find((x) => x.espacioId === b.id && x.fecha === fecha && x.turno === turno);
                  if (o?.propia) return <Celda tono="propia" texto="Tu reserva" detalle={veQuien ? o.codigo : undefined} etiqueta={`${turnoTexto}: tu reserva`} />;
                  if (o) return <Celda tono="ocupada" texto="Ocupada" detalle={o.codigo} etiqueta={`${turnoTexto}: ocupada${o.codigo ? ` por ${o.codigo}` : ""}`} />;
                  const disponible = inicioTurno(fecha, turno) > ahora && fecha <= sumarDias(hoy, leerReglas(b.reglas).anticipacionDias);
                  if (!disponible) return <Celda tono="nada" texto="—" etiqueta={`${turnoTexto}: no se puede reservar`} />;
                  if (!puedeReservar) return <Celda tono="ocupada" texto="Libre" etiqueta={`${turnoTexto}: libre`} />;
                  return (
                    <Celda
                      tono="libre"
                      texto="Libre"
                      detalle="Reservar"
                      href={`/reservas/barbacoas/reservar?espacio=${b.id}&fecha=${fecha}&turno=${turno}`}
                      etiqueta={`Reservar ${turnoTexto}`}
                    />
                  );
                },
              }))}
            />
          </>
        )}
      </section>

    </>
  );
}
