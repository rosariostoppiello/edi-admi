"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const PASOS = [
  { ruta: "ingresos", nombre: "Ingresos" },
  { ruta: "egresos", nombre: "Egresos" },
  { ruta: "cargos", nombre: "Cargos extra" },
  { ruta: "cuotas", nombre: "Cuotas" },
  { ruta: "fondos", nombre: "Fondos y textos" },
  { ruta: "revision", nombre: "Revisar y publicar" },
];

/** Los pasos de la confección: es una secuencia real, por eso van numerados. */
export function Pasos({ id }: { id: string }) {
  const ruta = usePathname();
  const ref = useRef<HTMLElement>(null);
  // En el celular la barra se desliza: se muestra el paso actual.
  useEffect(() => {
    const nav = ref.current;
    const actual = nav?.querySelector<HTMLElement>('[aria-current="step"]');
    if (nav && actual) nav.scrollLeft = actual.offsetLeft - nav.clientWidth / 2 + actual.clientWidth / 2;
  }, [ruta]);
  return (
    <nav ref={ref} aria-label="Pasos de la confección" className="relative -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ol className="flex min-w-max gap-2">
        {PASOS.map((p, i) => {
          const actual = ruta.endsWith(`/${p.ruta}`);
          return (
            <li key={p.ruta}>
              <Link
                href={`/liquidaciones/confeccion/${id}/${p.ruta}`}
                aria-current={actual ? "step" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-bold ${
                  actual ? "border-pizarra bg-pizarra text-white" : "border-junta-fuerte bg-losa hover:border-pizarra"
                }`}
              >
                <span aria-hidden="true" className={`tabular-nums ${actual ? "text-bronce-claro" : "text-pizarra-suave"}`}>
                  {i + 1}
                </span>
                {p.nombre}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
