import type { Metadata } from "next";
import Link from "next/link";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { puede } from "@/dominio/permisos";
import { exigirPermiso } from "@/servidor/sesion";
import { listarEspacios } from "@/servidor/reservas";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Reserva de espacios comunes" };

/** Barbacoas · Solarium · Laundry (C.2). Administración además configura los espacios. */
export default async function PaginaReservas() {
  const usuario = await exigirPermiso("reserva.ver");
  const modulo = buscarModulo("/reservas")!;
  // La piscina aparece solo en los edificios que tienen una (decisión 87).
  const conPiscina = (await listarEspacios("PISCINA")).length > 0;
  const teclas = subteclasVisibles(modulo.subteclas, usuario).filter((t) => conPiscina || t.ruta !== "/reservas/piscina");
  return (
    <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={teclas}>
      {puede(usuario, "reserva.configurarEspacios") && (
        <Link href="/reservas/espacios" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce-texto">
          Configurar los espacios y las tarifas
        </Link>
      )}
    </PantallaTeclas>
  );
}
