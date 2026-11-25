"use client";
/** Formularios de edificios. El servidor vuelve a validar todo. */
import { useState, useTransition } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla } from "@/componentes/ui/campo";
import { MensajeEstado, useAvisar, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

export function FormNuevoEdificio({ accion }: { accion: AccionForm }) {
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(accion);
  if (estado?.ok) return <MensajeEstado estado={estado} />;
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-5" noValidate>
      <MensajeEstado estado={estado} />
      <Campo etiqueta="Nombre del edificio" name="nombre" maxLength={80} error={errores.nombre} required />
      <Campo etiqueta="Dirección" name="direccion" maxLength={160} error={errores.direccion} />
      <AreaTexto
        etiqueta="Torres"
        name="torres"
        rows={4}
        defaultValue="1 Única"
        ayuda="Una por línea: el número y, si querés, el nombre (ej. 1 Norte). Con el número se arman los códigos de unidad (1-101)."
        error={errores.torres}
      />
      <Boton type="submit" className="self-start" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Pedir el alta"}
      </Boton>
    </form>
  );
}

export function RevisarEdificio({ aprobar, rechazar }: { aprobar: () => Promise<Estado>; rechazar: AccionForm }) {
  const avisar = useAvisar();
  const [resultado, setResultado] = useState<Estado>(null);
  const [aprobando, iniciar] = useTransition();
  const [rechazando, setRechazando] = useState(false);
  const rechazo = useEnvioConservado(async (prev, fd) => {
    const r = await rechazar(prev, fd);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  });
  const estado = resultado ?? rechazo.estado;
  if (estado?.ok) return null;
  return (
    <div className="flex flex-col gap-3">
      <MensajeEstado estado={estado} />
      {!rechazando ? (
        <div className="flex flex-wrap gap-3">
          <Boton
            type="button"
            disabled={aprobando}
            onClick={() =>
              iniciar(async () => {
                const r = await aprobar();
                if (r?.ok) avisar?.(r.mensaje);
                setResultado(r);
              })
            }
          >
            {aprobando ? "Aprobando…" : "Aprobar"}
          </Boton>
          <Boton type="button" variante="secundario" onClick={() => setRechazando(true)}>
            Rechazar
          </Boton>
        </div>
      ) : (
        <form onSubmit={rechazo.alEnviar} className="flex flex-col gap-3" noValidate>
          <Campo etiqueta="Motivo (opcional)" name="motivo" maxLength={500} ayuda="Le llega por mail a quien lo pidió." error={rechazo.errores.motivo} />
          <div className="flex flex-wrap gap-3">
            <Boton type="submit" variante="peligro" disabled={rechazo.pendiente}>
              {rechazo.pendiente ? "Rechazando…" : "Rechazar el pedido"}
            </Boton>
            <Boton type="button" variante="texto" onClick={() => setRechazando(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}

export function FormModulos({ accion, modulos }: { accion: AccionForm; modulos: { ruta: string; nombre: string; prendido: boolean }[] }) {
  const { estado, alEnviar, pendiente } = useEnvioConservado(accion);
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-3" noValidate>
      <MensajeEstado estado={estado} />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-bold">Módulos que se ven en el inicio</legend>
        {modulos.map((m) => (
          <Casilla key={m.ruta} etiqueta={m.nombre} name="modulos" value={m.ruta} defaultChecked={m.prendido} />
        ))}
      </fieldset>
      <p className="text-chico text-pizarra-suave">“Datos de propietarios e inquilinos” está siempre: ahí se manejan las cuentas.</p>
      <Boton type="submit" className="self-start" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </Boton>
    </form>
  );
}
