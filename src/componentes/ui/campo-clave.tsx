"use client";
import { useId, useState, type ComponentProps } from "react";
import { IconoAlerta, IconoOjo, IconoOjoTachado } from "./iconos";

/** Campo de contraseña con un botón (ojo) para ver lo que se escribe. */
export function CampoClave({
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { etiqueta: string; ayuda?: string; error?: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descripcion = [ayuda && idAyuda, error && idError].filter(Boolean).join(" ") || undefined;
  const Icono = visible ? IconoOjoTachado : IconoOjo;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          className={`min-h-12 w-full rounded-[var(--radius-campo)] border-2 bg-losa py-0 pl-3.5 pr-14 text-pizarra placeholder:text-pizarra-suave ${
            error ? "border-alerta" : "border-junta-fuerte focus-visible:border-bronce"
          }`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={`Mostrar lo escrito en «${etiqueta}»`}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? "Ocultar" : "Mostrar"}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-[var(--radius-campo)] text-pizarra-suave hover:text-pizarra"
        >
          <Icono className="size-6" />
        </button>
      </div>
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
