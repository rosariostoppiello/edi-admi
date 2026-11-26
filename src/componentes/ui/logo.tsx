import { MARCA } from "@/lib/marca";

/**
 * Logotipo: "Propiedad" en texto y la "H" grabada en una placa de bronce, como
 * las placas de las unidades (docs/design.md). Va sobre la cabecera pizarra.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-medio font-bold tracking-tight ${className}`}>
      <span className="sr-only">{MARCA}</span>
      <span aria-hidden="true">Propiedad</span>
      <span
        aria-hidden="true"
        className="inline-flex size-8 items-center justify-center rounded-[var(--radius-placa)] border-2 border-bronce bg-bronce-claro font-mono text-pizarra shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(47,95,87,0.25)]"
      >
        H
      </span>
    </span>
  );
}
