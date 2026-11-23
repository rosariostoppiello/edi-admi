import type { Metadata } from "next";
import Link from "next/link";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { puede } from "@/dominio/permisos";
import { exigirPermiso } from "@/servidor/sesion";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Reserva de espacios comunes" };

/** Barbacoas · Solarium · Laundry (C.2). Administración además configura los espacios. */
export default async function PaginaReservas() {
  const usuario = await exigirPermiso("reserva.ver");
  const modulo = buscarModulo("/reservas")!;
  return (
    <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)}>
      {puede(usuario, "reserva.configurarEspacios") && (
        <Link href="/reservas/espacios" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
          Configurar los espacios y las tarifas
        </Link>
      )}
    </PantallaTeclas>
  );
}
