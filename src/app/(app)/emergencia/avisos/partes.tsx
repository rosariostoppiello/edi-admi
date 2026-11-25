"use client";
/** Acciones de Portería y Administración sobre un aviso de emergencia. */
import { useState, useTransition } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Casilla } from "@/componentes/ui/campo";
import {
  MensajeEstado,
  useAvisar,
  useEnvioConservado,
  type Estado,
} from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

/**
 * Al avisar a todos o cerrar, el formulario desaparece (la página se actualiza en el
 * mismo paso): el mensaje de éxito se le pasa a la ZonaAvisos de la página antes.
 */
function useConAviso(accion: AccionForm) {
  const avisar = useAvisar();
  const conAviso: AccionForm = async (prev, fd) => {
    const r = await accion(prev, fd);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  };
  return { conAviso, ocultarExito: Boolean(avisar) };
}

export function FormAvisarTodos({
  accion,
  mensaje,
}: {
  accion: AccionForm;
  mensaje: string;
}) {
  const { conAviso, ocultarExito } = useConAviso(accion);
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(conAviso);
  const mostrar = ocultarExito && estado?.ok ? null : estado;
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <MensajeEstado estado={mostrar} />
      <AreaTexto
        etiqueta="Mensaje para todas las unidades"
        name="mensaje"
        rows={4}
        maxLength={600}
        defaultValue={mensaje}
        ayuda="No pongas quién avisó: el mensaje le llega a todo el edificio."
        error={errores.mensaje}
      />
      <Casilla
        etiqueta="Comprobé que la emergencia es real"
        name="confirmado"
        value="si"
      />
      {errores.confirmado && (
        <p className="text-chico font-bold text-alerta">{errores.confirmado}</p>
      )}
      <Boton
        type="submit"
        variante="peligro"
        className="self-start"
        disabled={pendiente}
      >
        {pendiente ? "Avisando…" : "Avisar a todas las unidades"}
      </Boton>
    </form>
  );
}

export function FormCerrar({ accion }: { accion: AccionForm }) {
  const { conAviso, ocultarExito } = useConAviso(accion);
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(conAviso);
  const mostrar = ocultarExito && estado?.ok ? null : estado;
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <MensajeEstado estado={mostrar} />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-bold">¿Cómo terminó?</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="estado"
            value="ATENDIDA"
            defaultChecked
            className="size-5 accent-[var(--bronce)]"
          />
          Se atendió la emergencia
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="estado"
            value="FALSA_ALARMA"
            className="size-5 accent-[var(--bronce)]"
          />
          Era una falsa alarma
        </label>
        {errores.estado && (
          <p className="text-chico font-bold text-alerta">{errores.estado}</p>
        )}
      </fieldset>
      <AreaTexto
        etiqueta="Nota (opcional)"
        name="nota"
        rows={2}
        maxLength={600}
        ayuda="Si se avisó a todos, la nota también les llega."
        error={errores.nota}
      />
      <Boton
        type="submit"
        variante="secundario"
        className="self-start"
        disabled={pendiente}
      >
        {pendiente ? "Guardando…" : "Cerrar el aviso"}
      </Boton>
    </form>
  );
}

export function BotonReintentar({ accion }: { accion: () => Promise<Estado> }) {
  const [estado, setEstado] = useState<Estado>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <MensajeEstado estado={estado} />
      <Boton
        type="button"
        variante="secundario"
        className="self-start"
        disabled={pendiente}
        onClick={() => iniciar(async () => setEstado(await accion()))}
      >
        {pendiente ? "Reintentando…" : "Reintentar los mails con error"}
      </Boton>
    </div>
  );
}
