import Link from "next/link";
import type { ComponentProps } from "react";

type Variante = "primario" | "secundario" | "peligro" | "texto";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-campo)] px-5 font-bold transition-[transform,background-color] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const variantes: Record<Variante, string> = {
  primario: "bg-bronce-fuerte text-white hover:bg-bronce-oscuro",
  secundario: "border-2 border-pizarra bg-losa text-pizarra hover:bg-granito",
  peligro: "bg-alerta text-white hover:brightness-90",
  texto: "px-2 text-pizarra underline underline-offset-4 hover:text-bronce-texto",
};

export function clasesBoton(variante: Variante = "primario", extra = "") {
  return `${base} ${variantes[variante]} ${extra}`;
}

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: Variante }) {
  return <button className={clasesBoton(variante, className)} {...props} />;
}

export function BotonEnlace({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: Variante }) {
  return <Link className={clasesBoton(variante, className)} {...props} />;
}
