import Link from "next/link";
import { exigirUsuario } from "@/servidor/sesion";
import { NOMBRE_COMPLEJO, NOMBRE_ROL, codigoDePersona } from "@/lib/edificio";
import { unidadActiva } from "@/servidor/unidad-activa";
import { puede } from "@/dominio/permisos";
import { alertasParaCabecera } from "@/servidor/emergencias";
import { Logo } from "@/componentes/ui/logo";
import { IconoEmergencia } from "@/componentes/ui/iconos";
import { salir } from "./acciones";
import { AlertaEmergencia } from "./alerta-emergencia";
import { SelectorUnidad } from "./selector-unidad";

const TIPO = { APTO: "Apartamento", LOCAL: "Local", GARAJE: "Garaje", OFICINA: "Oficina" } as const;

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const unidad = await unidadActiva(usuario);
  const alertas = await alertasParaCabecera(usuario);
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
          <Link href="/inicio" className="flex min-h-11 flex-wrap items-center gap-x-3 hover:opacity-90">
            <Logo />
            <span className="text-chico text-white/85">{NOMBRE_COMPLEJO}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/emergencia"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-campo)] bg-alerta px-3 text-chico font-bold text-white ring-1 ring-white/40 hover:brightness-110"
            >
              <IconoEmergencia className="size-5" />
              Emergencia
            </Link>
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
      <AlertaEmergencia alertas={alertas} refrescar={puede(usuario, "emergencia.ver")} />
      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 pt-6 md:pt-10">
        {children}
      </main>
    </div>
  );
}
