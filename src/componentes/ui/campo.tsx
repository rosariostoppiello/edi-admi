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

function Ayudas({ id, ayuda, error }: { id: string; ayuda?: string; error?: string }) {
  return (
    <>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-chico text-pizarra-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-chico font-bold text-alerta">
          <IconoAlerta className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </>
  );
}

function describir(id: string, ayuda?: string, error?: string) {
  return [ayuda && `${id}-ayuda`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
}

const claseControl = (error?: string) =>
  `min-h-12 rounded-[var(--radius-campo)] border-2 bg-losa px-3.5 text-pizarra ${
    error ? "border-alerta" : "border-junta-fuerte focus-visible:border-bronce"
  }`;

export function Selector({
  etiqueta,
  ayuda,
  error,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { etiqueta: string; ayuda?: string; error?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {etiqueta}
      </label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describir(id, ayuda, error)} className={claseControl(error)} {...props}>
        {children}
      </select>
      <Ayudas id={id} ayuda={ayuda} error={error} />
    </div>
  );
}

export function AreaTexto({
  etiqueta,
  ayuda,
  error,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { etiqueta: string; ayuda?: string; error?: string }) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="font-bold">
        {etiqueta}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(id, ayuda, error)}
        className={`${claseControl(error)} py-3 leading-relaxed`}
        {...props}
      />
      <Ayudas id={id} ayuda={ayuda} error={error} />
    </div>
  );
}

/** Casilla de verificación con área táctil de 44 px. */
export function Casilla({ etiqueta, ayuda, ...props }: ComponentProps<"input"> & { etiqueta: string; ayuda?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3">
        <input id={id} type="checkbox" className="size-5 shrink-0 accent-[var(--bronce)]" {...props} />
        <span>{etiqueta}</span>
      </label>
      {ayuda && <p className="pl-8 text-chico text-pizarra-suave">{ayuda}</p>}
    </div>
  );
}
