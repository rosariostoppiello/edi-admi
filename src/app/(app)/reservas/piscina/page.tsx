import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { puede } from "@/dominio/permisos";
import { listarEspacios } from "@/servidor/reservas";
import { exigirPermiso } from "@/servidor/sesion";
import { Encabezado } from "../encabezado";

export const metadata: Metadata = { title: "Piscina" };

/** Informativo: horarios y reglas de la piscina (decisión 87). Solo si el edificio tiene. */
export default async function PaginaPiscina() {
  const usuario = await exigirPermiso("reserva.ver");
  const piscina = (await listarEspacios("PISCINA"))[0];
  if (!piscina) notFound();
  return (
    <>
      <Encabezado titulo="Piscina" />
      <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
        {piscina.descripcion ? (
          <div className="flex flex-col gap-3 whitespace-pre-line">{piscina.descripcion}</div>
        ) : (
          <p>La Administración todavía no cargó los horarios y las reglas de la piscina.</p>
        )}
      </div>
      {puede(usuario, "reserva.configurarEspacios") && (
        <Link href={`/reservas/espacios#${piscina.id}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
          Editar este texto
        </Link>
      )}
    </>
  );
}
