"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authCliente } from "@/lib/auth-cliente";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { CampoClave } from "@/componentes/ui/campo-clave";
import { Aviso } from "@/componentes/ui/aviso";

export function FormIngresar() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setEnviando(true);
    setError(null);
    const { error } = await authCliente.signIn.email({
      email: String(datos.get("email") ?? "").trim(),
      password: String(datos.get("password") ?? ""),
    });
    setEnviando(false);
    if (error) {
      setError(
        error.status === 429
          ? "Hubo demasiados intentos. Esperá un minuto y probá de nuevo."
          : "El mail o la contraseña no coinciden. Revisalos y probá de nuevo.",
      );
      return;
    }
    router.replace("/inicio");
    router.refresh();
  }

  return (
    <form onSubmit={alEnviar} className="mt-6 flex flex-col gap-5" noValidate>
      {error && <Aviso tono="error">{error}</Aviso>}
      <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" inputMode="email" required />
      <CampoClave etiqueta="Contraseña" name="password" autoComplete="current-password" required />
      <Boton type="submit" disabled={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </Boton>
      <Link href="/recuperar" className="self-start py-2 underline underline-offset-4 hover:text-bronce-texto">
        Me olvidé la contraseña
      </Link>
    </form>
  );
}
