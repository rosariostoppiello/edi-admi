"use client";
/** Formularios de Teléfonos y datos de interés (solo Administración; el servidor vuelve a validar). */
import { useEffect, useRef } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla } from "@/componentes/ui/campo";
import { AccionConfirmada, Desplegable, MensajeEstado, useAvisar, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;
type AccionSimple = (estado: Estado) => Promise<Estado>;

export interface DefCampo {
  name: string;
  etiqueta: string;
  valor?: string;
  ayuda?: string;
  tipo?: "text" | "tel" | "email" | "date";
  area?: boolean;
}

export function FormCampos({
  accion,
  campos,
  casilla,
  textoBoton = "Guardar",
  limpiar = false,
  alTerminar,
}: {
  accion: AccionForm;
  campos: DefCampo[];
  casilla?: { name: string; etiqueta: string; ayuda?: string; marcada: boolean };
  textoBoton?: string;
  limpiar?: boolean;
  alTerminar?: () => void;
}) {
  const avisar = useAvisar();
  const { estado, alEnviar, pendiente, errores: err } = useEnvioConservado(async (prev, fd) => {
    const r = await accion(prev, fd);
    if (r?.ok) {
      avisar?.(r.mensaje);
      alTerminar?.();
    }
    return r;
  });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && limpiar) ref.current?.reset();
  }, [estado, limpiar]);
  return (
    <form ref={ref} onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((c) =>
          c.area ? (
            <AreaTexto key={c.name} etiqueta={c.etiqueta} name={c.name} rows={3} defaultValue={c.valor} ayuda={c.ayuda} error={err[c.name]} className="sm:col-span-2" />
          ) : (
            <Campo
              key={c.name}
              etiqueta={c.etiqueta}
              name={c.name}
              type={c.tipo ?? "text"}
              inputMode={c.tipo === "tel" ? "tel" : c.tipo === "email" ? "email" : undefined}
              defaultValue={c.valor}
              ayuda={c.ayuda}
              error={err[c.name]}
            />
          ),
        )}
      </div>
      {casilla && <Casilla etiqueta={casilla.etiqueta} name={casilla.name} defaultChecked={casilla.marcada} ayuda={casilla.ayuda} />}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : textoBoton}
      </Boton>
    </form>
  );
}

/** Botón que despliega un FormCampos y lo cierra al guardar. */
export function FormDesplegable({ textoDesplegar, ...props }: Parameters<typeof FormCampos>[0] & { textoDesplegar: string }) {
  return <Desplegable textoBoton={textoDesplegar}>{(cerrar) => <FormCampos {...props} alTerminar={cerrar} />}</Desplegable>;
}

export function Quitar({ accion, nombre }: { accion: AccionSimple; nombre: string }) {
  return (
    <AccionConfirmada accion={accion} textoBoton="Quitar" textoConfirmar="Sí, quitar" explicacion={<p>{nombre} deja de aparecer en la lista.</p>} />
  );
}
