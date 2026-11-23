import type { Metadata } from "next";
import Link from "next/link";
import { PantallaTeclas } from "@/componentes/ui/pantalla-teclas";
import { puede } from "@/dominio/permisos";
import { exigirUsuario } from "@/servidor/sesion";
import { contarNuevas } from "@/servidor/solicitudes";
import { buscarModulo, subteclasVisibles } from "../modulos";

export const metadata: Metadata = { title: "Solicitudes varias" };

/** Aviso de desperfectos · Consultas de gastos comunes · Inquietudes varias (C.3). */
export default async function PaginaSolicitudes() {
  const usuario = await exigirUsuario();
  const modulo = buscarModulo("/solicitudes")!;
  const nuevas = await contarNuevas();
  return (
    <PantallaTeclas titulo={modulo.nombre} Icono={modulo.Icono} teclas={subteclasVisibles(modulo.subteclas, usuario)}>
      {puede(usuario, "solicitud.verTodas") && (
        <Link href="/solicitudes/bandeja" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
          Bandeja de solicitudes{nuevas > 0 ? ` (${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"})` : ""}
        </Link>
      )}
    </PantallaTeclas>
  );
}
