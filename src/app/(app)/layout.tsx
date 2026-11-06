import Link from "next/link";
import { exigirUsuario } from "@/servidor/sesion";
import { NOMBRE_COMPLEJO, NOMBRE_ROL, codigoDePersona } from "@/lib/edificio";
import { unidadActiva } from "@/servidor/unidad-activa";
import { salir } from "./acciones";
import { SelectorUnidad } from "./selector-unidad";

const TIPO = { APTO: "Apartamento", LOCAL: "Local", GARAJE: "Garaje", OFICINA: "Oficina" } as const;

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const unidad = await unidadActiva(usuario);
  const opciones = usuario.unidadesDetalle.map((u) => ({
    unidadId: u.unidadId,
    codigo: codigoDePersona(u),
    descripcion: `${TIPO[u.tipo]} en ${u.torreNombre}`,
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-losa focus:px-4 focus:py-2"
      >
        Ir al contenido
      </a>
      <header className="sobre-pizarra bg-pizarra text-white">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="flex min-h-11 items-center text-medio font-bold hover:underline">
            {NOMBRE_COMPLEJO}
          </Link>
          <div className="flex items-center gap-3">
            {unidad ? (
              <SelectorUnidad activa={opciones.find((o) => o.unidadId === unidad.unidadId)!} opciones={opciones} />
            ) : (
              <span className="text-chico text-white/85">{NOMBRE_ROL[usuario.rol]}</span>
            )}
            <form action={salir}>
              <button
                type="submit"
                className="min-h-11 rounded-[var(--radius-campo)] px-3 text-chico font-bold text-white underline-offset-4 hover:underline"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 md:pt-10">
        {children}
      </main>
    </div>
  );
}
