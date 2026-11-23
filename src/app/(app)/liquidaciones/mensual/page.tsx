import type { Metadata } from "next";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { IconoLiquidacion } from "@/componentes/ui/iconos";
import { exigirPermiso } from "@/servidor/sesion";
import { LIQUIDACION_MENSUAL, subteclasVisibles, volverDeLiquidacionMensual } from "../../modulos";

export const metadata: Metadata = { title: "Liquidación mensual" };

export default async function PaginaLiquidacionMensual() {
  const usuario = await exigirPermiso("liquidacion.ver");
  return (
    <PantallaTeclas
      titulo="Liquidación mensual"
      Icono={IconoLiquidacion}
      teclas={subteclasVisibles(LIQUIDACION_MENSUAL, usuario)}
      volver={volverDeLiquidacionMensual(usuario)}
    >
      <p className="text-pizarra-suave">Cuando se publica una liquidación, te llega por mail y queda acá como la última.</p>
    </PantallaTeclas>
  );
}
