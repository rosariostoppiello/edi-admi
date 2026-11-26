/**
 * La placa de bronce con el código de la unidad: el único elemento "material"
 * del sistema (ver docs/design.md).
 */
export function Placa({
  codigo,
  tamano = "normal",
  className = "",
}: {
  codigo: string;
  tamano?: "chica" | "normal" | "grande";
  className?: string;
}) {
  const tamanos = {
    chica: "px-2 py-0.5 text-chico",
    normal: "px-3 py-1 text-base",
    grande: "px-4 py-2 text-grande",
  };
  return (
    <span
      className={`inline-block rounded-[var(--radius-placa)] border-2 border-bronce bg-bronce-claro font-mono font-bold tracking-wide text-pizarra shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(47,95,87,0.25)] ${tamanos[tamano]} ${className}`}
    >
      {codigo}
    </span>
  );
}
