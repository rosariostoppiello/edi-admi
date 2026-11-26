import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { obtenerUsuario } from "@/servidor/sesion";
import { BotonEnlace } from "@/componentes/ui/boton";
import { Logo } from "@/componentes/ui/logo";
import { Placa } from "@/componentes/ui/placa";
import {
  IconoComunicados,
  IconoDatos,
  IconoEmergencia,
  IconoLiquidacion,
  IconoReservas,
  IconoSolicitudes,
  IconoTelefonos,
} from "@/componentes/ui/iconos";
import { LEMA, MARCA } from "@/lib/marca";

type Icono = ComponentType<SVGProps<SVGSVGElement>>;

const PASOS: { titulo: string; texto: string }[] = [
  {
    titulo: "La Administración publica la liquidación",
    texto:
      "Carga los gastos del mes, revisa el resumen por rubro y la publica. El sistema calcula intereses y fondo de reserva.",
  },
  {
    titulo: "Cada unidad la recibe",
    texto:
      "Llega un mail con el PDF, y en el sistema se ve el saldo, el detalle y las liquidaciones anteriores.",
  },
  {
    titulo: "Los vecinos resuelven desde el celular",
    texto:
      "Reservan la barbacoa, el solarium o el laundry, avisan desperfectos con foto y hacen consultas.",
  },
  {
    titulo: "Y si hay una emergencia, se avisa al instante",
    texto:
      "Un botón avisa a Portería y a la Administración, que pueden avisar a todo el edificio.",
  },
];

const ROLES: { titulo: string; texto: string; Icono: Icono }[] = [
  {
    titulo: "Propietarios e inquilinos",
    texto:
      "Su liquidación y el PDF, reservas, solicitudes, comunicados y sus datos de contacto.",
    Icono: IconoDatos,
  },
  {
    titulo: "Comisión Administradora",
    texto:
      "La liquidación de todas las unidades, las solicitudes y las actas de asamblea.",
    Icono: IconoComunicados,
  },
  {
    titulo: "Portería",
    texto:
      "Quién reservó cada turno, solicitudes a pedido de los vecinos y las alertas de emergencia.",
    Icono: IconoEmergencia,
  },
  {
    titulo: "Administración",
    texto:
      "La confección de la liquidación, los datos de las unidades, los comunicados y las respuestas.",
    Icono: IconoLiquidacion,
  },
];

/** Las teclas del panel, en chico, para mostrar cómo se ve el sistema por dentro. */
const TECLAS: { nombre: string; Icono: Icono }[] = [
  { nombre: "Liquidación", Icono: IconoLiquidacion },
  { nombre: "Reservas", Icono: IconoReservas },
  { nombre: "Solicitudes", Icono: IconoSolicitudes },
  { nombre: "Comunicados", Icono: IconoComunicados },
  { nombre: "Teléfonos", Icono: IconoTelefonos },
  { nombre: "Datos", Icono: IconoDatos },
];


function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mx-auto w-full max-w-6xl px-4 py-12 md:py-16"
    >
      <h2 id={id} className="text-grande font-bold md:text-enorme">
        {titulo}
      </h2>
      <div className="mt-6 md:mt-8">{children}</div>
    </section>
  );
}

/** El panel del sistema dibujado dentro de un celular. */
function Celular() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto w-full max-w-[19rem] rounded-[2rem] border-[10px] border-pizarra bg-granito shadow-[0_24px_48px_-24px_rgba(29,40,48,0.55)]"
    >
      <div className="flex items-center justify-between rounded-t-[1.35rem] bg-cabecera px-3 py-2.5 text-white">
        <Logo className="!text-base [&>span:last-child]:size-6" />
        <span className="rounded bg-alerta px-1.5 py-0.5 text-[0.6875rem] font-bold">
          Emergencia
        </span>
      </div>
      <div className="px-3 pb-4 pt-3 text-pizarra">
        <div className="flex items-center gap-2 text-[0.75rem] text-pizarra-suave">
          Unidad <Placa codigo="2-101-A" tamano="chica" />
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {TECLAS.map(({ nombre, Icono }) => (
            <li
              key={nombre}
              className="flex min-h-20 flex-col gap-1.5 rounded-[10px] border border-junta border-b-4 border-b-junta-fuerte bg-losa p-2.5"
            >
              <Icono className="size-6 text-bronce-texto" />
              <span className="text-[0.8125rem] font-bold leading-tight">
                {nombre}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Pantalla de inicio pública. Con sesión, el botón de arriba lleva al panel. */
export default async function PantallaDeInicio() {
  const conSesion = Boolean(await obtenerUsuario());

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sobre-pizarra bg-cabecera text-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center hover:opacity-90"
          >
            <Logo />
          </Link>
          <Link
            href={conSesion ? "/inicio" : "/ingresar"}
            className="inline-flex min-h-11 items-center rounded-[var(--radius-campo)] border-2 border-white px-4 font-bold hover:bg-white hover:text-pizarra"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="sobre-pizarra bg-cabecera pb-14 text-white md:pb-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 md:grid-cols-[1.15fr_1fr] md:pt-14">
            <div>
              <p className="text-medio font-bold text-bronce-claro">{MARCA}</p>
              <h1 className="mt-2 text-enorme font-bold leading-tight md:text-[3rem]">
                {LEMA}
              </h1>
              <p className="mt-4 max-w-prose text-medio text-white/85">
                La liquidación de gastos comunes, las reservas, las solicitudes
                y los comunicados del edificio, claros y todo en línea, en la
                web y en el celular.
              </p>
              <p className="mt-3 max-w-prose text-medio text-white/85">
                Para propietarios, inquilinos, Comisión Administradora, Portería
                y Administración.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <BotonEnlace href={conSesion ? "/inicio" : "/ingresar"}>Ingresar</BotonEnlace>
                <a
                  href="#como-funciona"
                  className="inline-flex min-h-12 items-center rounded-[var(--radius-campo)] border-2 border-white/70 px-5 font-bold hover:bg-white/10"
                >
                  Cómo funciona
                </a>
              </div>
            </div>
            <Celular />
          </div>
        </section>


        <Seccion id="como-funciona" titulo="Cómo funciona">
          <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p, i) => (
              <li
                key={p.titulo}
                className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-5"
              >
                <Placa codigo={String(i + 1)} className="self-start" />
                <h3 className="text-medio font-bold leading-tight">
                  {p.titulo}
                </h3>
                <p className="text-pizarra-suave">{p.texto}</p>
              </li>
            ))}
          </ol>
        </Seccion>

        <Seccion id="roles" titulo="Qué ve cada uno">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map(({ titulo, texto, Icono }) => (
              <li
                key={titulo}
                className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta border-b-4 border-b-junta-fuerte bg-losa p-5"
              >
                <Icono className="size-9 text-bronce-texto" />
                <h3 className="text-medio font-bold leading-tight">{titulo}</h3>
                <p className="text-pizarra-suave">{texto}</p>
              </li>
            ))}
          </ul>
        </Seccion>

        <Seccion id="para-todos" titulo="Pensado para todo el edificio">
          <ul className="grid max-w-4xl gap-x-8 gap-y-4 md:grid-cols-2">
            {[
              [
                "No hay que instalar nada",
                "Se usa desde el navegador del celular o la computadora.",
              ],
              [
                "Fácil de leer",
                "Letras grandes y claras, botones cómodos de tocar y buen contraste.",
              ],
              [
                "Datos protegidos",
                "Cada unidad ve solo lo suyo. Los teléfonos y mails no se muestran entre vecinos (Ley 18.331).",
              ],
              [
                "Cuentas claras",
                "Cada liquidación publicada queda fija: si hay que corregir, se anula y se rehace, y queda registrado.",
              ],
            ].map(([t, d]) => (
              <li key={t} className="border-l-4 border-bronce pl-4">
                <h3 className="font-bold">{t}</h3>
                <p className="text-pizarra-suave">{d}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <BotonEnlace href={conSesion ? "/inicio" : "/ingresar"}>Ingresar</BotonEnlace>
          </div>
        </Seccion>
      </main>

      <footer className="border-t border-junta">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-chico text-pizarra-suave">
          <span>
            {MARCA} · {LEMA}
          </span>
          <span>Uruguay</span>
        </div>
      </footer>
    </div>
  );
}
