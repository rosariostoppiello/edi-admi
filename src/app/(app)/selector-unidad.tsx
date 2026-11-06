"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Placa } from "@/componentes/ui/placa";
import { accionElegirUnidad } from "./datos/acciones";

export interface OpcionUnidad {
  unidadId: string;
  codigo: string;
  descripcion: string;
}

/**
 * La placa de la cabecera. Si el usuario tiene varias unidades (ej. apto + garaje),
 * al tocarla se elige con cuál trabajar.
 */
export function SelectorUnidad({ activa, opciones }: { activa: OpcionUnidad; opciones: OpcionUnidad[] }) {
  const ruta = usePathname();
  const detalles = useRef<HTMLDetailsElement>(null);

  // Cerrar con Escape o al tocar afuera.
  useEffect(() => {
    const d = detalles.current;
    if (!d) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && d.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    const alTocar = (e: MouseEvent) => {
      if (d.open && !d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("click", alTocar);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("click", alTocar);
    };
  }, []);

  if (opciones.length <= 1) {
    return (
      <span className="flex items-center gap-2">
        <span className="sr-only">Tu unidad:</span>
        <Placa codigo={activa.codigo} />
      </span>
    );
  }

  return (
    <details ref={detalles} className="relative">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Unidad activa:</span>
        <Placa codigo={activa.codigo} />
        <span aria-hidden="true" className="text-chico">▾</span>
        <span className="sr-only">Cambiar de unidad</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-[var(--radius-campo)] border border-junta bg-losa p-2 text-pizarra shadow-[0_8px_24px_rgba(29,40,48,0.18)]">
        <p className="px-2 py-1 text-chico text-pizarra-suave">Elegí con qué unidad trabajar</p>
        <ul>
          {opciones.map((o) => (
            <li key={o.unidadId}>
              <form action={accionElegirUnidad}>
                <input type="hidden" name="unidadId" value={o.unidadId} />
                <input type="hidden" name="volverA" value={ruta} />
                <button
                  type="submit"
                  aria-current={o.unidadId === activa.unidadId ? "true" : undefined}
                  className="flex min-h-12 w-full items-center gap-3 rounded px-2 text-left hover:bg-granito aria-[current]:font-bold"
                >
                  <span className="font-mono font-bold">{o.codigo}</span>
                  <span className="text-chico text-pizarra-suave">{o.descripcion}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
