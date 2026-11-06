import { useId, type ComponentProps } from "react";
import { IconoAlerta } from "./iconos";

export function Campo({
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: ComponentProps<"input"> & { etiqueta: string; ayuda?: string; error?: string }) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda && idAyuda, error && idError].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {etiqueta}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripcion}
        className={`min-h-12 rounded-[var(--radius-campo)] border-2 bg-losa px-3.5 text-pizarra placeholder:text-pizarra-suave ${
          error ? "border-alerta" : "border-junta-fuerte focus-visible:border-bronce"
        }`}
        {...props}
      />
      {ayuda && (
        <p id={idAyuda} className="text-chico text-pizarra-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={idError} className="flex items-start gap-1.5 text-chico font-bold text-alerta">
          <IconoAlerta className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
