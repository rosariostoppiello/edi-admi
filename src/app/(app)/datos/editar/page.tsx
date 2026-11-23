import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { unidadActiva } from "@/servidor/unidad-activa";
import { Ficha } from "../ficha";
import { Volver } from "../volver";

export const metadata: Metadata = { title: "Editar datos" };

/** Tecla Editar: el flujo de la unidad (responsable → ¿alquilada? → inquilino), sobre la unidad activa. */
export default async function PaginaEditarDatos() {
  const usuario = await exigirUsuario();
  const activa = await unidadActiva(usuario);
  if (!activa) redirect("/datos");
  return (
    <>
      <Volver href="/datos" texto="Mis datos" />
      <div className="mt-4">
        <Ficha unidadId={activa.unidadId} modo="editar" />
      </div>
    </>
  );
}
