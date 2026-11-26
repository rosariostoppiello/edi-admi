"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { colorTorre } from "@/lib/edificio";

export interface FilaUnidad {
  id: string;
  torre: number;
  torreColor: string;
  torreNombre: string;
  codigo: string;
  personas: string[];
  alquilada: boolean;
  pendiente: boolean;
}

const normalizar = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ListadoUnidades({ filas, conEnlace }: { filas: FilaUnidad[]; conEnlace: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [torre, setTorre] = useState<number | null>(null);
  const torres = useMemo(
    () => [...new Map(filas.map((f) => [f.torre, f.torreNombre])).entries()],
    [filas],
  );

  const visibles = filas.filter((f) => {
    if (torre !== null && f.torre !== torre) return false;
    const q = normalizar(busqueda.trim());
    if (!q) return true;
    return normalizar(`${f.codigo} ${f.personas.join(" ")}`).includes(q);
  });

  return (
    <div className="mt-5 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="buscar" className="font-bold">
          Buscar por número o nombre
        </label>
        <input
          id="buscar"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Ej. 201 o Pereira"
          className="min-h-12 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-losa px-3.5 focus-visible:border-bronce"
        />
      </div>
      <div role="group" aria-label="Filtrar por torre" className="flex flex-wrap gap-2">
        {[[null, "Todas"] as const, ...torres].map(([codigo, nombre]) => (
          <button
            key={String(codigo)}
            type="button"
            aria-pressed={torre === codigo}
            onClick={() => setTorre(codigo)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-junta-fuerte bg-losa px-4 font-bold aria-pressed:border-cabecera aria-pressed:bg-cabecera aria-pressed:text-white"
          >
            {codigo !== null && (
              <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colorTorre(filas.find((f) => f.torre === codigo)?.torreColor) }} />
            )}
            {nombre}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {visibles.length} unidades
      </p>
      {visibles.length === 0 ? (
        <p className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-5">
          No hay unidades que coincidan con &quot;{busqueda}&quot;. Probá con el número sin la torre (ej. 201).
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-junta overflow-hidden rounded-[var(--radius-tecla)] border border-junta bg-losa">
          {visibles.map((f) => {
            const contenido = (
              <>
                <span className="flex w-24 shrink-0 items-center gap-2 font-mono font-bold">
                  <span aria-hidden="true" className="inline-block size-2.5 rounded-full" style={{ background: colorTorre(f.torreColor) }} />
                  {f.codigo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{f.personas.join(", ") || "Sin datos"}</span>
                  <span className="flex flex-wrap gap-x-3 text-chico text-pizarra-suave">
                    {f.alquilada && <span>Alquilada</span>}
                    {f.pendiente && <span className="font-bold text-alerta">Falta que confirme sus datos</span>}
                  </span>
                </span>
              </>
            );
            return (
              <li key={f.id}>
                {conEnlace ? (
                  <Link href={`/datos/${f.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-granito">
                    {contenido}
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-4 py-3">{contenido}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
