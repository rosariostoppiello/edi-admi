import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { IconoDatos } from "@/componentes/ui/iconos";
import { elegirEdificio } from "../acciones";

export const metadata: Metadata = { title: "Elegí el edificio" };

const TECLA =
  "group flex h-full min-h-28 w-full flex-col items-start gap-3 rounded-[var(--radius-tecla)] border border-junta border-b-4 border-b-junta-fuerte bg-losa p-4 text-left transition-[transform,border-color] hover:border-bronce hover:border-b-bronce active:translate-y-[3px] active:border-b md:p-6";

/** Quien está en varios edificios elige con cuál trabajar (decisión 86). */
export default async function PaginaEdificios() {
  const usuario = await exigirUsuario();
  if (usuario.edificios.length < 2) redirect("/inicio");

  return (
    <>
      <h1 className="text-grande font-bold md:text-enorme">Elegí el edificio</h1>
      <p className="mt-1 text-pizarra-suave">Después podés cambiarlo desde arriba, al lado del nombre del edificio.</p>
      <nav aria-label="Edificios" className="mt-6 md:mt-8">
        <ul className="grid gap-3 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {usuario.edificios.map((e) => (
            <li key={e.id}>
              <form action={elegirEdificio.bind(null, e.id)}>
                <button type="submit" className={TECLA}>
                  <IconoDatos className="size-9 text-bronce-texto" />
                  <span className="text-medio font-bold leading-tight md:text-titulo">{e.nombre}</span>
                  {usuario.edificioElegido && e.id === usuario.edificio.id && <span className="text-chico text-pizarra-suave">Es con el que estás trabajando</span>}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
