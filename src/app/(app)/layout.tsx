import Link from "next/link";
import { exigirUsuario } from "@/servidor/sesion";
import { Placa } from "@/componentes/ui/placa";
import { NOMBRE_COMPLEJO, NOMBRE_ROL, codigoDePersona } from "@/lib/edificio";
import { salir } from "./acciones";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const unidad = usuario.unidadesDetalle[0];

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
              <span className="flex items-center gap-2">
                <span className="sr-only">Tu unidad:</span>
                <Placa codigo={codigoDePersona(unidad)} />
              </span>
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
