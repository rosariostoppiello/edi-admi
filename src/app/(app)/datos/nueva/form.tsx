"use client";
import { useActionState } from "react";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { MensajeEstado, type Estado } from "@/componentes/ui/formularios";
import { accionCrearUnidad } from "../acciones";

const claseSelect =
  "min-h-12 rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-losa px-3 focus-visible:border-bronce";

function Selector({
  etiqueta,
  name,
  opciones,
  error,
}: {
  etiqueta: string;
  name: string;
  opciones: [string, string][];
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="font-bold">
        {etiqueta}
      </label>
      <select id={name} name={name} className={claseSelect} aria-invalid={error ? true : undefined}>
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
      {error && <p className="text-chico font-bold text-alerta">{error}</p>}
    </div>
  );
}

export function FormNuevaUnidad({ torres }: { torres: { codigo: number; numero: number; nombre: string }[] }) {
  const [estado, enviar, pendiente] = useActionState<Estado, FormData>(accionCrearUnidad, null);
  const err = estado && !estado.ok ? estado.campos ?? {} : {};

  return (
    <form action={enviar} className="mt-6 flex max-w-xl flex-col gap-5" noValidate>
      <MensajeEstado estado={estado} />
      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <legend className="px-1 text-medio font-bold">La unidad</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Torre"
            name="torreId"
            opciones={torres.map((t) => [String(t.codigo), `Torre ${t.numero} (${t.nombre})`])}
            error={err.torreId}
          />
          <Campo etiqueta="Número" name="numero" inputMode="numeric" ayuda="Ej. 201, 1002 o 001" error={err.numero} required />
        </div>
        <Selector
          etiqueta="Tipo"
          name="tipo"
          opciones={[
            ["APTO", "Apartamento"],
            ["LOCAL", "Local"],
            ["GARAJE", "Garaje"],
            ["OFICINA", "Oficina"],
          ]}
          error={err.tipo}
        />
        <Campo etiqueta="Descripción (opcional)" name="etiqueta" ayuda="Ej. Local 1-2-3 o Garaje 14" error={err.etiqueta} />
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
        <legend className="px-1 text-medio font-bold">Responsable</legend>
        <div className="flex flex-col gap-2">
          <span className="font-bold">Calidad</span>
          {[
            ["PROPIETARIO", "Propietario"],
            ["PROMITENTE", "Promitente comprador"],
          ].map(([valor, texto]) => (
            <label key={valor} className="flex min-h-11 items-center gap-3">
              <input type="radio" name="calidad" value={valor} defaultChecked={valor === "PROPIETARIO"} className="size-5 accent-[var(--bronce)]" />
              {texto}
            </label>
          ))}
        </div>
        <Campo etiqueta="Nombre" name="nombre" autoComplete="off" error={err.nombre} required />
        <Campo etiqueta="Apellido" name="apellido" autoComplete="off" error={err.apellido} required />
        <Campo etiqueta="Teléfono" name="telefono" type="tel" inputMode="tel" ayuda="Ej. 099 123 456" error={err.telefono} required />
        <Campo etiqueta="Mail" name="email" type="email" inputMode="email" ayuda="Le llega la invitación y la liquidación." error={err.email} required />
      </fieldset>

      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Creando…" : "Crear unidad"}
      </Boton>
    </form>
  );
}
