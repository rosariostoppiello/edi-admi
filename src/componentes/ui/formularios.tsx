"use client";
import { createContext, startTransition, useActionState, useContext, useState, type FormEvent, type ReactNode } from "react";
import { Aviso } from "./aviso";
import { Boton } from "./boton";
import { Campo } from "./campo";

export type Estado =
  | { ok: true; mensaje: string }
  | { ok: false; error: string; campos?: Partial<Record<string, string>> }
  | null;

type Accion = (estado: Estado, fd: FormData) => Promise<Estado>;

const ContextoAvisos = createContext<((mensaje: string) => void) | null>(null);

/**
 * Zona que conserva el aviso de éxito aunque el formulario que lo generó
 * desaparezca al refrescarse la página (ej. al cargar un inquilino, el
 * formulario de alta se reemplaza por su ficha). Los formularios de adentro
 * le pasan su mensaje en lugar de mostrarlo ellos.
 */
/** Para formularios propios: si están dentro de una ZonaAvisos, le pasan su mensaje de éxito. */
export function useAvisar() {
  return useContext(ContextoAvisos);
}

export function ZonaAvisos({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <ContextoAvisos.Provider value={setAviso}>
      {aviso && <Aviso tono="ok">{aviso}</Aviso>}
      {children}
    </ContextoAvisos.Provider>
  );
}

/**
 * Envío de formulario que conserva lo escrito si hay un error (con `action={...}`
 * React limpia el formulario siempre, aun cuando el servidor devuelve errores).
 */
export function useEnvioConservado(accion: Accion, preparar?: (fd: FormData) => Promise<FormData>) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const [preparando, setPreparando] = useState(false);
  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    let fd = new FormData(e.currentTarget);
    if (preparar) {
      setPreparando(true);
      try {
        fd = await preparar(fd);
      } finally {
        setPreparando(false);
      }
    }
    startTransition(() => enviar(fd));
  };
  const errores: Partial<Record<string, string>> = estado && !estado.ok ? (estado.campos ?? {}) : {};
  return { estado, alEnviar, pendiente: pendiente || preparando, errores };
}

/** Resultado de una acción: aviso de éxito o de error. */
export function MensajeEstado({ estado }: { estado: Estado }) {
  if (!estado) return null;
  return <Aviso tono={estado.ok ? "ok" : "error"}>{estado.ok ? estado.mensaje : estado.error}</Aviso>;
}

export interface ValoresPersona {
  nombre?: string;
  telefono?: string;
  email?: string;
  calidad?: string;
}

/**
 * Formulario de datos de contacto (nombre, teléfono, mail y, para el dueño, calidad).
 * Los valores quedan cargados si hay error, para no tener que reescribir.
 */
export function FormPersona({
  accion,
  valores = {},
  conCalidad = false,
  textoBoton,
  ayudaMail,
  alTerminar,
}: {
  accion: Accion;
  valores?: ValoresPersona;
  conCalidad?: boolean;
  textoBoton: string;
  ayudaMail?: string;
  alTerminar?: () => void;
}) {
  const avisar = useContext(ContextoAvisos);
  const [estado, enviar, pendiente] = useActionState(async (prev: Estado, fd: FormData) => {
    const r = await accion(prev, fd);
    if (r?.ok) {
      alTerminar?.();
      avisar?.(r.mensaje);
    }
    return r;
  }, null);
  const err = estado && !estado.ok ? estado.campos ?? {} : {};

  return (
    <form action={enviar} className="flex flex-col gap-4" noValidate>
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      {conCalidad && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-bold">Calidad</legend>
          {[
            ["PROPIETARIO", "Propietario"],
            ["PROMITENTE", "Promitente comprador"],
          ].map(([valor, etiqueta]) => (
            <label key={valor} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="calidad"
                value={valor}
                defaultChecked={(valores.calidad ?? "PROPIETARIO") === valor}
                className="size-5 accent-[var(--bronce)]"
              />
              {etiqueta}
            </label>
          ))}
          {err.calidad && <p className="text-chico font-bold text-alerta">{err.calidad}</p>}
        </fieldset>
      )}
      <Campo etiqueta="Nombre y apellido" name="nombre" autoComplete="name" defaultValue={valores.nombre} error={err.nombre} required />
      <Campo
        etiqueta="Teléfono"
        name="telefono"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        defaultValue={valores.telefono}
        error={err.telefono}
        ayuda="Ej. 099 123 456"
        required
      />
      <Campo
        etiqueta="Mail"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={valores.email}
        error={err.email}
        ayuda={ayudaMail}
        required
      />
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : textoBoton}
      </Boton>
    </form>
  );
}

/**
 * Acción irreversible en dos pasos: primero se explica qué va a pasar,
 * después se confirma con un botón que repite el verbo.
 */
export function AccionConfirmada({
  accion,
  textoBoton,
  explicacion,
  textoConfirmar,
  variante = "peligro",
}: {
  accion: (estado: Estado) => Promise<Estado>;
  textoBoton: string;
  explicacion: ReactNode;
  textoConfirmar: string;
  variante?: "peligro" | "secundario" | "primario";
}) {
  const [abierto, setAbierto] = useState(false);
  const avisar = useContext(ContextoAvisos);
  const [estado, enviar, pendiente] = useActionState(async (prev: Estado) => {
    const r = await accion(prev);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  }, null);

  if (estado?.ok) return avisar ? null : <MensajeEstado estado={estado} />;

  if (!abierto) {
    return (
      <div className="flex flex-col gap-3">
        <MensajeEstado estado={estado} />
        <Boton type="button" variante={variante === "primario" ? "primario" : "secundario"} className="self-start" onClick={() => setAbierto(true)}>
          {textoBoton}
        </Boton>
      </div>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-granito p-4">
      <MensajeEstado estado={estado} />
      <div>{explicacion}</div>
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" variante={variante} disabled={pendiente}>
          {pendiente ? "Un momento…" : textoConfirmar}
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={pendiente}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

/** Botón que muestra/oculta un formulario (ej. "Editar mis datos"). */
export function Desplegable({ textoBoton, children }: { textoBoton: string; children: (cerrar: () => void) => ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <Boton type="button" variante="secundario" className="self-start" onClick={() => setAbierto(true)}>
        {textoBoton}
      </Boton>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {children(() => setAbierto(false))}
      <button type="button" className="min-h-11 self-start py-2 underline underline-offset-4" onClick={() => setAbierto(false)}>
        Cancelar
      </button>
    </div>
  );
}
