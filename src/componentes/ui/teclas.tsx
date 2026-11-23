import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

/**
 * La tecla del portero eléctrico (docs/design.md). La grande es la del home, con
 * ícono y descripción; la chica es el sub-botón de un módulo, solo con el nombre.
 */
const BASE =
  "group flex rounded-[var(--radius-tecla)] border border-junta border-b-4 border-b-junta-fuerte bg-losa transition-[transform,border-color] hover:border-bronce hover:border-b-bronce active:translate-y-[3px] active:border-b";

export function Tecla({
  href,
  nombre,
  descripcion,
  Icono,
}: {
  href: string;
  nombre: string;
  descripcion?: string;
  Icono?: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <Link
      href={href}
      className={`${BASE} h-full min-h-36 flex-col gap-3 p-4 active:pb-[calc(1rem+3px)] md:min-h-44 md:p-6`}
    >
      {Icono && <Icono className="size-9 text-bronce md:size-11" />}
      <span className="text-medio font-bold leading-tight md:text-titulo">{nombre}</span>
      {descripcion && <span className="text-[0.9375rem] text-pizarra-suave md:text-base">{descripcion}</span>}
    </Link>
  );
}

export function TeclaChica({ href, nombre }: { href: string; nombre: string }) {
  return (
    <Link
      href={href}
      className={`${BASE} h-full min-h-16 items-center px-4 py-3 text-medio font-bold leading-tight active:pb-[calc(0.75rem+3px)] md:min-h-20 md:px-6`}
    >
      {nombre}
    </Link>
  );
}

/** Botonera de sub-botones: en columna en el celular (como el gráfico), en grilla desde tablet. */
export function Teclado({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <nav aria-label={etiqueta}>
      <ul className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">{children}</ul>
    </nav>
  );
}
