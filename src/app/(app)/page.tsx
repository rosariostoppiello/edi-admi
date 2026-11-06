import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/servidor/sesion";
import { MODULOS } from "./modulos";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio() {
  const usuario = await exigirUsuario();
  const nombre = usuario.nombre.split(" ")[0];

  return (
    <>
      <h1 className="text-grande font-bold md:text-enorme">Hola, {nombre}</h1>
      <p className="mt-1 text-pizarra-suave">¿Qué necesitás hacer?</p>

      <nav aria-label="Secciones" className="mt-6 md:mt-8">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {MODULOS.map(({ ruta, nombre, descripcion, Icono }) => (
            <li key={ruta}>
              <Link
                href={ruta}
                className="group flex h-full min-h-36 flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta border-b-4 border-b-junta-fuerte bg-losa p-4 transition-[transform,border-color] hover:border-bronce hover:border-b-bronce active:translate-y-[3px] active:border-b active:pb-[calc(1rem+3px)] md:min-h-44 md:p-6"
              >
                <Icono className="size-9 text-bronce md:size-11" />
                <span className="text-medio font-bold leading-tight md:text-titulo">{nombre}</span>
                <span className="text-[0.9375rem] text-pizarra-suave md:text-base">{descripcion}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
