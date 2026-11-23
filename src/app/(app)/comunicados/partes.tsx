"use client";
/** Formularios de Comunicados (solo Administración; el servidor vuelve a validar). */
import { useEffect, useRef } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla } from "@/componentes/ui/campo";
import { AccionConfirmada, Desplegable, MensajeEstado, useAvisar, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;
type AccionSimple = (estado: Estado) => Promise<Estado>;

export interface ValoresComunicado {
  titulo?: string;
  fecha?: string;
  cuerpo?: string;
}

export function FormComunicado({
  accion,
  valores = {},
  conMail,
  mailPorDefecto,
  pdfObligatorio,
  tienePdf,
  textoBoton,
  alTerminar,
}: {
  accion: AccionForm;
  valores?: ValoresComunicado;
  conMail: boolean;
  mailPorDefecto: boolean;
  pdfObligatorio: boolean;
  tienePdf?: boolean;
  textoBoton: string;
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
    if (estado?.ok && !valores.titulo) ref.current?.reset();
  }, [estado, valores.titulo]);

  return (
    <form ref={ref} onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Campo etiqueta="Título" name="titulo" defaultValue={valores.titulo} error={err.titulo} required />
        <Campo etiqueta="Fecha" name="fecha" type="date" defaultValue={valores.fecha} error={err.fecha} required />
      </div>
      <AreaTexto
        etiqueta={pdfObligatorio ? "Texto (opcional)" : "Texto"}
        name="cuerpo"
        rows={5}
        defaultValue={valores.cuerpo}
        ayuda={pdfObligatorio ? undefined : "Escribí el texto, subí un PDF o las dos cosas."}
        error={err.cuerpo}
      />
      <Campo
        etiqueta={tienePdf ? "Reemplazar el PDF (opcional)" : pdfObligatorio ? "PDF" : "PDF (opcional)"}
        name="archivo"
        type="file"
        accept="application/pdf,.pdf"
        ayuda="Hasta 3 MB."
        error={err.archivo}
        className="[&_input]:py-2.5"
      />
      {conMail && <Casilla etiqueta="Enviar por mail a todos" name="enviar" defaultChecked={mailPorDefecto} ayuda="A los responsables, inquilinos y mails extra de cada unidad." />}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Publicando…" : textoBoton}
      </Boton>
    </form>
  );
}

export function DarDeBaja({ accion, titulo }: { accion: AccionSimple; titulo: string }) {
  return (
    <AccionConfirmada
      accion={accion}
      textoBoton="Dar de baja"
      textoConfirmar="Sí, dar de baja"
      explicacion={<p>&quot;{titulo}&quot; deja de verse para todos. Queda registrado quién lo dio de baja.</p>}
    />
  );
}

export function BotonChico({ accion, texto, etiqueta }: { accion: AccionSimple; texto: string; etiqueta: string }) {
  const avisar = useAvisar();
  const { estado, alEnviar, pendiente } = useEnvioConservado(async (prev) => {
    const r = await accion(prev);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  });
  return (
    <form onSubmit={alEnviar}>
      {estado && !estado.ok && <MensajeEstado estado={estado} />}
      <button type="submit" disabled={pendiente} aria-label={etiqueta} className="min-h-11 min-w-11 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-losa px-3 font-bold hover:border-bronce">
        {texto}
      </button>
    </form>
  );
}

/** Botón que despliega el formulario (publicar o editar). */
export function FormDesplegable({ textoDesplegar, enCaja = false, ...props }: Parameters<typeof FormComunicado>[0] & { textoDesplegar: string; enCaja?: boolean }) {
  return (
    <Desplegable textoBoton={textoDesplegar}>
      {(cerrar) =>
        enCaja ? (
          <div className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
            <FormComunicado {...props} alTerminar={cerrar} />
          </div>
        ) : (
          <FormComunicado {...props} alTerminar={cerrar} />
        )
      }
    </Desplegable>
  );
}
