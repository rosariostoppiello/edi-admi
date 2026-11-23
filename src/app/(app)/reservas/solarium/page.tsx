import type { Metadata } from "next";
import { DATOS_TURNO, REGLAS_POR_DEFECTO, fechaEnFrase, fechaUy, finTurno, solariumDisponible, sumarDias } from "@/dominio/reservas";
import { listarEspacios, ocupacion } from "@/servidor/reservas";
import { exigirPermiso } from "@/servidor/sesion";
import { Calendario, Celda, DIAS_POR_PAGINA, NavegarSemanas, desdeValido } from "../calendario";
import { Encabezado } from "../encabezado";

export const metadata: Metadata = { title: "Solarium" };

/** Cada solarium se puede usar solo si su barbacoa no está reservada en ese turno. No se reserva. */
export default async function PaginaSolarium({ searchParams }: PageProps<"/reservas/solarium">) {
  await exigirPermiso("reserva.ver");
  const sp = await searchParams;
  const solariums = (await listarEspacios("SOLARIUM")).filter((s) => s.barbacoaId);
  const ahora = new Date();
  const hoy = fechaUy(ahora);
  const limite = sumarDias(hoy, REGLAS_POR_DEFECTO.anticipacionDias);
  const desde = desdeValido(typeof sp.desde === "string" ? sp.desde : undefined, hoy, limite);
  const ocupados = await ocupacion(desde, sumarDias(desde, DIAS_POR_PAGINA - 1));

  return (
    <>
      <Encabezado titulo="Solarium" />
      <p className="mt-3 max-w-prose text-pizarra-suave">
        El solarium no se reserva. Cada uno se puede usar cuando su barbacoa no está reservada en ese turno.
      </p>
      <section aria-labelledby="disponibilidad" className="mt-6 flex flex-col gap-4">
        <h2 id="disponibilidad" className="text-titulo font-bold">
          Disponibilidad
        </h2>
        {solariums.length === 0 ? (
          <p className="text-pizarra-suave">No hay solariums cargados.</p>
        ) : (
          <>
            <NavegarSemanas ruta="/reservas/solarium" desde={desde} hoy={hoy} limite={limite} />
            <Calendario
              desde={desde}
              etiqueta="Disponibilidad de los solariums por día"
              filas={solariums.map((s) => ({
                id: s.id,
                nombre: s.nombre.replace(/^Solarium\s+/i, ""),
                celda: (fecha, turno) => {
                  const texto = `${s.nombre}, ${fechaEnFrase(fecha)}, ${DATOS_TURNO[turno].nombre.toLowerCase()}`;
                  if (finTurno(fecha, turno) <= ahora) return <Celda tono="nada" texto="—" etiqueta={`${texto}: ya pasó`} />;
                  const deSuBarbacoa = ocupados.filter((o) => o.espacioId === s.barbacoaId);
                  return solariumDisponible(deSuBarbacoa, fecha, turno) ? (
                    <Celda tono="propia" texto="Disponible" etiqueta={`${texto}: disponible`} />
                  ) : (
                    <Celda tono="ocupada" texto="No disponible" detalle="Barbacoa reservada" etiqueta={`${texto}: no disponible, la barbacoa está reservada`} />
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
