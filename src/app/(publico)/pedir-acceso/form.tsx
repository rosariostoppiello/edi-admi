"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Aviso } from "@/componentes/ui/aviso";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla, Selector } from "@/componentes/ui/campo";
import { MensajeEstado, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type EstadoPedido = (Estado & { pedidoId?: string }) | null;
type AccionForm = (estado: EstadoPedido, fd: FormData) => Promise<EstadoPedido>;

const CALIDADES = [
  ["PROPIETARIO", "Propietario"],
  ["PROMITENTE", "Promitente comprador"],
  ["INQUILINO", "Inquilino"],
] as const;

export function FormPedirAcceso({
  accion,
  verificar,
  edificios,
}: {
  accion: AccionForm;
  verificar: AccionForm;
  edificios: { id: string; nombre: string }[];
}) {
  const { estado: e, alEnviar, pendiente, errores } = useEnvioConservado(accion);
  const estado = e as EstadoPedido;

  if (estado?.ok && estado.pedidoId) return <VerificarCodigo accion={verificar} pedidoId={estado.pedidoId} aviso={estado.mensaje} />;
  if (estado?.ok) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <Aviso tono="ok">{estado.mensaje}</Aviso>
        <Link href="/ingresar" className="self-start py-2 underline underline-offset-4 hover:text-bronce">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} className="mt-6 flex flex-col gap-5" noValidate>
      <MensajeEstado estado={estado} />
      <Campo etiqueta="Nombre" name="nombre" autoComplete="given-name" error={errores.nombre} required />
      <Campo etiqueta="Apellido" name="apellido" autoComplete="family-name" error={errores.apellido} required />
      <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" inputMode="email" ayuda="Va a ser tu usuario para ingresar." error={errores.email} required />
      <Campo etiqueta="Teléfono" name="telefono" type="tel" autoComplete="tel" inputMode="tel" ayuda="Ej. 099 123 456. Solo lo ve la Administración." error={errores.telefono} required />
      {edificios.length > 0 && (
        <Selector etiqueta="Tu edificio" name="edificioId" defaultValue="" error={errores.edificioId}>
          <option value="" disabled>
            Elegí tu edificio
          </option>
          {edificios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Selector>
      )}
      <Campo etiqueta="Tu unidad" name="codigo" autoComplete="off" autoCapitalize="characters" placeholder="2-201" ayuda="Torre y número, ej. 2-201" error={errores.codigo} required />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-bold">Sos…</legend>
        {CALIDADES.map(([valor, etiqueta]) => (
          <label key={valor} className="flex min-h-11 items-center gap-3">
            <input type="radio" name="calidad" value={valor} className="size-5 accent-[var(--bronce)]" />
            {etiqueta}
          </label>
        ))}
        {errores.calidad && <p className="text-chico font-bold text-alerta">{errores.calidad}</p>}
      </fieldset>
      <AreaTexto etiqueta="Algo más que quieras contarnos (opcional)" name="mensaje" rows={3} maxLength={500} error={errores.mensaje} />
      {/* Campo trampa para robots: no se ve ni se puede enfocar. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          No completar
          <input type="text" name="sitio" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Casilla
        etiqueta="Acepto que la Administración use estos datos para comprobar que soy de la unidad y darme acceso."
        name="acepto"
        value="si"
      />
      {errores.acepto && <p className="text-chico font-bold text-alerta">{errores.acepto}</p>}
      <Boton type="submit" disabled={pendiente}>
        {pendiente ? "Enviando…" : "Pedir acceso"}
      </Boton>
    </form>
  );
}

/** Segundo paso: el código de 6 números que le llegó al mail confirma que el mail es suyo. */
function VerificarCodigo({ accion, pedidoId, aviso }: { accion: AccionForm; pedidoId: string; aviso: string }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  if (estado?.ok) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <Aviso tono="ok">{estado.mensaje}</Aviso>
        <Link href="/ingresar" className="self-start py-2 underline underline-offset-4 hover:text-bronce">
          Volver a ingresar
        </Link>
      </div>
    );
  }
  const err = estado && !estado.ok ? (estado.campos ?? {}) : {};
  return (
    <form action={enviar} className="mt-6 flex flex-col gap-5" noValidate>
      {estado ? <MensajeEstado estado={estado} /> : <Aviso tono="info">{aviso}</Aviso>}
      <input type="hidden" name="pedidoId" value={pedidoId} />
      <Campo
        etiqueta="Código de verificación"
        name="codigoVerificacion"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        ayuda="Son 6 números. Si no lo ves, revisá el correo no deseado."
        error={err.codigoVerificacion}
        required
      />
      <Boton type="submit" disabled={pendiente}>
        {pendiente ? "Confirmando…" : "Confirmar"}
      </Boton>
    </form>
  );
}
