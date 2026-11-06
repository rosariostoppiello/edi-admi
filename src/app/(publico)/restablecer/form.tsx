"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authCliente } from "@/lib/auth-cliente";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { Aviso } from "@/componentes/ui/aviso";

export function FormRestablecer({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const clave = String(datos.get("clave") ?? "");
    const repetida = String(datos.get("repetida") ?? "");
    if (clave.length < 10) return setError("La contraseña tiene que tener al menos 10 caracteres.");
    if (clave !== repetida) return setError("Las dos contraseñas no coinciden.");
    setEnviando(true);
    setError(null);
    const { error } = await authCliente.resetPassword({ newPassword: clave, token });
    setEnviando(false);
    if (error) return setError("El enlace venció o ya se usó. Pedí uno nuevo.");
    setListo(true);
  }

  if (listo) {
    return (
      <div className="mt-6 flex flex-col gap-5">
        <Aviso tono="ok">Listo, cambiaste tu contraseña.</Aviso>
        <Link href="/ingresar" className="self-start py-2 underline underline-offset-4">
          Ingresar con la contraseña nueva
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={alEnviar} className="mt-6 flex flex-col gap-5" noValidate>
      {error && <Aviso tono="error">{error}</Aviso>}
      <Campo etiqueta="Contraseña nueva" name="clave" type="password" autoComplete="new-password" required minLength={10} />
      <Campo etiqueta="Repetí la contraseña" name="repetida" type="password" autoComplete="new-password" required />
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </Boton>
    </form>
  );
}
