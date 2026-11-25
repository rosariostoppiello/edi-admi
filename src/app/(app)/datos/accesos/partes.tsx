"use client";
/** Aprobar o rechazar un pedido de acceso. El servidor vuelve a validar todo. */
import { useState, useTransition } from "react";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import {
  MensajeEstado,
  useAvisar,
  useEnvioConservado,
  type Estado,
} from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

export function AccionesPedido({
  aprobar,
  rechazar,
  efecto,
}: {
  aprobar: () => Promise<Estado>;
  rechazar: AccionForm;
  efecto: string;
}) {
  // Al resolverse, el pedido pasa a "Resueltos" y esta parte desaparece: el mensaje de
  // éxito lo muestra la ZonaAvisos de la página.
  const avisar = useAvisar();
  const [resultado, setResultado] = useState<Estado>(null);
  const [aprobando, iniciar] = useTransition();
  const [modo, setModo] = useState<"botones" | "confirmar" | "rechazar">(
    "botones",
  );
  const rechazo = useEnvioConservado(async (prev, fd) => {
    const r = await rechazar(prev, fd);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  });
  const estado = resultado ?? rechazo.estado;

  if (estado?.ok) return avisar ? null : <MensajeEstado estado={estado} />;

  return (
    <div className="flex flex-col gap-3">
      <MensajeEstado estado={estado} />
      {modo === "botones" && (
        <div className="flex flex-wrap gap-3">
          <Boton type="button" onClick={() => setModo("confirmar")}>
            Aprobar
          </Boton>
          <Boton
            type="button"
            variante="secundario"
            onClick={() => setModo("rechazar")}
          >
            Rechazar
          </Boton>
        </div>
      )}
      {modo === "confirmar" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-campo)] border-l-4 border-bronce bg-granito px-4 py-3">
          <p className="font-bold">¿Comprobaste que es de esa unidad?</p>
          <p>{efecto}</p>
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
              {aprobando ? "Aprobando…" : "Sí, aprobar"}
            </Boton>
            <Boton
              type="button"
              variante="texto"
              disabled={aprobando}
              onClick={() => setModo("botones")}
            >
              Cancelar
            </Boton>
          </div>
        </div>
      )}
      {modo === "rechazar" && (
        <form
          onSubmit={rechazo.alEnviar}
          className="flex flex-col gap-3"
          noValidate
        >
          <Campo
            etiqueta="Motivo (opcional)"
            name="motivo"
            maxLength={500}
            ayuda="Le llega por mail a la persona."
            error={rechazo.errores.motivo}
          />
          <div className="flex flex-wrap gap-3">
            <Boton
              type="submit"
              variante="peligro"
              disabled={rechazo.pendiente}
            >
              {rechazo.pendiente ? "Rechazando…" : "Rechazar el pedido"}
            </Boton>
            <Boton
              type="button"
              variante="texto"
              onClick={() => setModo("botones")}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}
