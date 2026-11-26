import { IconoReservas } from "@/componentes/ui/iconos";
import { Volver } from "../datos/volver";

/** Volver a Reservas + título de la sección. */
export function Encabezado({ titulo, volver = { href: "/reservas", texto: "Reserva de espacios comunes" } }: { titulo: string; volver?: { href: string; texto: string } }) {
  return (
    <>
      <Volver href={volver.href} texto={volver.texto} />
      <div className="mt-4 flex items-center gap-3">
        <IconoReservas className="size-10 shrink-0 text-bronce-texto" />
        <h1 className="text-grande font-bold">{titulo}</h1>
      </div>
    </>
  );
}
