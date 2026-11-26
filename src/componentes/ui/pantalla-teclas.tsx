import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { IconoVolver } from "./iconos";
import { TeclaChica, Teclado } from "./teclas";

export interface TeclaVisible {
  ruta: string;
  nombre: string;
}

/**
 * Pantalla de sub-botones de un módulo (decisión 31). Recibe las teclas ya
 * filtradas por permiso. Si queda una sola, salta directo a esa pantalla.
 */
export function PantallaTeclas({
  titulo,
  Icono,
  teclas,
  volver = { href: "/inicio", texto: "Inicio" },
  children,
}: {
  titulo: string;
  Icono?: ComponentType<SVGProps<SVGSVGElement>>;
  teclas: TeclaVisible[];
  volver?: { href: string; texto: string };
  children?: ReactNode;
}) {
  if (teclas.length === 1) redirect(teclas[0].ruta);
  return (
    <>
      <Link href={volver.href} className="-ml-2 inline-flex min-h-11 items-center gap-1 px-2 font-bold hover:text-bronce-texto">
        <IconoVolver className="size-5" />
        {volver.texto}
      </Link>
      <div className="mt-4 flex items-center gap-3">
        {Icono && <Icono className="size-10 shrink-0 text-bronce-texto" />}
        <h1 className="text-grande font-bold">{titulo}</h1>
      </div>
      {children && <div className="mt-3 max-w-prose">{children}</div>}
      <div className="mt-6">
        <Teclado etiqueta={titulo}>
          {teclas.map((t) => (
            <li key={t.ruta}>
              <TeclaChica href={t.ruta} nombre={t.nombre} />
            </li>
          ))}
        </Teclado>
      </div>
    </>
  );
}
