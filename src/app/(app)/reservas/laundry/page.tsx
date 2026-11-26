import type { Metadata } from "next";
import Link from "next/link";
import { puede } from "@/dominio/permisos";
import { listarEspacios } from "@/servidor/reservas";
import { exigirPermiso } from "@/servidor/sesion";
import { Encabezado } from "../encabezado";

export const metadata: Metadata = { title: "Laundry" };

/** Informativo: el laundry funciona con tarjeta prepaga, con un sistema propio (decisión 16). */
export default async function PaginaLaundry() {
  const usuario = await exigirPermiso("reserva.ver");
  const laundry = (await listarEspacios("LAUNDRY"))[0];
  return (
    <>
      <Encabezado titulo="Laundry" />
      <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
        {laundry?.descripcion ? (
          <div className="flex flex-col gap-3 whitespace-pre-line">{laundry.descripcion}</div>
        ) : (
          <p>El laundry funciona con un sistema propio y no se reserva desde acá. Por cualquier consulta, hablá con la Administración.</p>
        )}
      </div>
      {laundry && puede(usuario, "reserva.configurarEspacios") && (
        <Link href={`/reservas/espacios#${laundry.id}`} className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce-texto">
          Editar este texto
        </Link>
      )}
    </>
  );
}
