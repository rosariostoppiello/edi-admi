"use client";
/** Formularios de Solicitudes. El servidor vuelve a validar permisos y datos. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla, Selector } from "@/componentes/ui/campo";
import { MensajeEstado, useAvisar, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";
import { enlaceWhatsapp } from "@/dominio/solicitudes";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

/** Enlace a WhatsApp con el texto prearmado. No es una integración: abre la app con el mensaje escrito. */
export function BotonWhatsapp({ numero, categoria, codigo, asunto }: { numero: string; categoria: string; codigo?: string | null; asunto: string }) {
  return (
    <a
      href={enlaceWhatsapp(numero, { categoria, codigo, asunto })}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center self-start rounded-[var(--radius-campo)] border-2 border-pizarra bg-losa px-5 font-bold hover:bg-granito"
    >
      Escribir por WhatsApp
    </a>
  );
}

/**
 * Achica la foto en el navegador (lado mayor 1600 px, JPEG) para que una foto del
 * celular de 4 o 5 MB suba en segundos y entre en el límite. Si no se puede, va tal cual.
 */
async function achicarFoto(fd: FormData): Promise<FormData> {
  const f = fd.get("foto");
  if (!(f instanceof File) || f.size === 0) {
    fd.delete("foto");
    return fd;
  }
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d")!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.82));
    if (blob) fd.set("foto", blob, "foto.jpg");
  } catch {
    // Formato que el navegador no puede leer: el servidor decide.
  }
  return fd;
}

export function FormSolicitud({
  accion,
  categoria,
  esPorteria,
  codigo,
  whatsapp,
  ayudaTexto,
  conFoto = false,
}: {
  accion: AccionForm;
  categoria: string;
  esPorteria: boolean;
  codigo: string | null;
  whatsapp: string;
  ayudaTexto: string;
  conFoto?: boolean;
}) {
  const [enviada, setEnviada] = useState<{ asunto: string; codigo: string | null } | null>(null);
  const [origen, setOrigen] = useState(esPorteria ? "" : "UNIDAD");
  const { estado, alEnviar, pendiente, errores: err } = useEnvioConservado(async (prev, fd) => {
    const r = await accion(prev, fd);
    if (r?.ok) {
      const cod = esPorteria ? (origen === "A_PEDIDO" ? String(fd.get("codigo") ?? "") : null) : codigo;
      setEnviada({ asunto: String(fd.get("asunto") ?? ""), codigo: cod });
    }
    return r;
  }, conFoto ? achicarFoto : undefined);

  if (estado?.ok && enviada) {
    return (
      <div className="flex flex-col gap-4">
        <MensajeEstado estado={estado} />
        {whatsapp && (
          <div className="flex flex-col gap-2">
            <p className="text-pizarra-suave">Si es urgente, escribile también a la Administración por WhatsApp. El mensaje ya va armado.</p>
            <BotonWhatsapp numero={whatsapp} categoria={categoria} codigo={enviada.codigo} asunto={enviada.asunto} />
          </div>
        )}
        <button type="button" className="min-h-11 self-start py-2 font-bold underline underline-offset-4 hover:text-bronce" onClick={() => location.reload()}>
          Hacer otra solicitud
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <MensajeEstado estado={estado} />
      {esPorteria && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-bold">¿Para quién es?</legend>
          {[
            ["PROPIA", "Por mí (Portería)"],
            ["A_PEDIDO", "A pedido de una unidad"],
          ].map(([v, t]) => (
            <label key={v} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="origen" value={v} checked={origen === v} onChange={() => setOrigen(v)} className="size-5 accent-[var(--bronce)]" />
              {t}
            </label>
          ))}
          {err.origen && <p className="text-chico font-bold text-alerta">{err.origen}</p>}
        </fieldset>
      )}
      {origen === "A_PEDIDO" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Unidad" name="codigo" placeholder="2-201" autoComplete="off" ayuda="Torre y número, ej. 2-201" error={err.codigo} required />
          <Campo etiqueta="Quién lo pidió" name="pedidaPor" autoComplete="off" ayuda="Nombre de la persona de la unidad" error={err.pedidaPor} required />
        </div>
      )}
      <Campo etiqueta="Asunto" name="asunto" autoComplete="off" error={err.asunto} required />
      <AreaTexto etiqueta="Contá qué pasa" name="texto" rows={5} ayuda={ayudaTexto} error={err.texto} required />
      {conFoto && (
        <Campo
          etiqueta="Foto (opcional)"
          name="foto"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          ayuda="Desde el celular podés sacarla en el momento."
          error={err.foto}
          className="[&_input]:py-2.5"
        />
      )}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Enviando…" : "Enviar a la Administración"}
      </Boton>
    </form>
  );
}

/** Formulario chico de la gestión (responder, nota interna, estado). */
function FormGestion({ accion, children, texto }: { accion: AccionForm; children: (err: Partial<Record<string, string>>) => ReactNode; texto: string }) {
  const avisar = useAvisar();
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(async (prev, fd) => {
    const r = await accion(prev, fd);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);
  return (
    <form ref={ref} onSubmit={alEnviar} className="flex flex-col gap-3" noValidate>
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      {children(errores)}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : texto}
      </Boton>
    </form>
  );
}

export function FormResponder({ accion }: { accion: AccionForm }) {
  return (
    <FormGestion accion={accion} texto="Enviar respuesta">
      {(err) => (
        <>
          <AreaTexto etiqueta="Respuesta" name="texto" rows={4} ayuda="La ve quien hizo la solicitud y le llega por mail." error={err.texto} required />
          <Casilla etiqueta="Marcar como resuelta" name="resuelta" />
        </>
      )}
    </FormGestion>
  );
}

export function FormNota({ accion }: { accion: AccionForm }) {
  return (
    <FormGestion accion={accion} texto="Guardar nota">
      {(err) => <AreaTexto etiqueta="Nota interna" name="texto" rows={3} ayuda="Solo la ve la Administración." error={err.texto} required />}
    </FormGestion>
  );
}

export function FormEstado({ accion, actual }: { accion: AccionForm; actual: string }) {
  return (
    <FormGestion accion={accion} texto="Cambiar estado">
      {(err) => (
        <Selector etiqueta="Estado" name="estado" defaultValue={actual} error={err.estado} className="max-w-xs">
          <option value="NUEVA">Nueva</option>
          <option value="EN_CURSO">En curso</option>
          <option value="RESUELTA">Resuelta</option>
        </Selector>
      )}
    </FormGestion>
  );
}

export function FormWhatsapp({ accion, actual }: { accion: AccionForm; actual: string }) {
  return (
    <FormGestion accion={accion} texto="Guardar número">
      {(err) => (
        <Campo
          etiqueta="WhatsApp de la Administración"
          name="whatsapp"
          type="tel"
          inputMode="tel"
          defaultValue={actual ? `+${actual}` : ""}
          ayuda="Celular, ej. 099 123 456. Vacío: no se muestra el botón de WhatsApp."
          error={err.whatsapp}
          className="max-w-sm"
        />
      )}
    </FormGestion>
  );
}
