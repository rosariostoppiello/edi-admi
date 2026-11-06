"use client";
import { useActionState } from "react";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { MensajeEstado, type Estado } from "@/componentes/ui/formularios";

export function FormCrear({
  accion,
  pedirPeriodo,
  periodoSugerido,
}: {
  accion: (e: Estado, fd: FormData) => Promise<Estado>;
  pedirPeriodo: boolean;
  periodoSugerido: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const err = estado && !estado.ok ? (estado.campos ?? {}) : {};
  return (
    <form action={enviar} className="flex flex-col gap-4">
      <MensajeEstado estado={estado} />
      {pedirPeriodo && (
        <Campo etiqueta="Mes" name="periodo" type="month" defaultValue={periodoSugerido} error={err.periodo} className="max-w-xs" required />
      )}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Creando…" : "Crear borrador"}
      </Boton>
    </form>
  );
}
