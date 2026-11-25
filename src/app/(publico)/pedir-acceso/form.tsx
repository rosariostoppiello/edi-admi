"use client";
import Link from "next/link";
import { Aviso } from "@/componentes/ui/aviso";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla, Selector } from "@/componentes/ui/campo";
import { MensajeEstado, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

const CALIDADES = [
  ["PROPIETARIO", "Propietario"],
  ["PROMITENTE", "Promitente comprador"],
  ["INQUILINO", "Inquilino"],
] as const;

export function FormPedirAcceso({ accion, edificios }: { accion: AccionForm; edificios: { id: string; nombre: string }[] }) {
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(accion);

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
      <Campo etiqueta="Nombre y apellido" name="nombre" autoComplete="name" error={errores.nombre} required />
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
