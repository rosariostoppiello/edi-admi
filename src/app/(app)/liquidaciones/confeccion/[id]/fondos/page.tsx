import type { Metadata } from "next";
import { leerDisponibilidades } from "@/servidor/liquidacion/armado";
import { obtenerBorrador } from "@/servidor/liquidacion/confeccion";
import { accionGuardarDisponibilidades, accionGuardarParametros } from "../../../acciones";
import { Seccion } from "../../../partes";
import { EditorDisponibilidades, FormParametros } from "../../formularios";

export const metadata: Metadata = { title: "Fondos y textos de la liquidación" };

/** 150 → "1,5" */
const porcentaje = (pb: number) => (pb % 100 === 0 ? String(pb / 100) : `${Math.floor(pb / 100)},${String(pb % 100).padStart(2, "0").replace(/0$/, "")}`);

export default async function PaginaFondos({ params }: PageProps<"/liquidaciones/confeccion/[id]/fondos">) {
  const { id } = await params;
  const liq = (await obtenerBorrador(id))!;
  return (
    <>
      <Seccion titulo="Disponibilidades">
        <p className="max-w-prose text-pizarra-suave">
          Los ingresos, los egresos y los depósitos identificados se calculan solos con lo cargado. Acá completás los saldos iniciales y
          las otras cuentas (caja chica, cuenta en dólares).
        </p>
        <EditorDisponibilidades accion={accionGuardarDisponibilidades.bind(null, id)} inicial={leerDisponibilidades(liq.disponibilidades)} />
      </Seccion>
      <Seccion titulo="Parámetros y procedimiento de pago">
        <FormParametros
          accion={accionGuardarParametros.bind(null, id)}
          valores={{
            tasaInteres: porcentaje(liq.tasaInteresPb),
            tasaFondoReserva: porcentaje(liq.tasaFondoReservaPb),
            diaVencimiento: liq.diaVencimiento,
            procedimientoPago: liq.procedimientoPago,
          }}
        />
      </Seccion>
    </>
  );
}
