"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { authCliente } from "@/lib/auth-cliente";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { Aviso } from "@/componentes/ui/aviso";

export default function PaginaRecuperar() {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "enviado" | "error">("inicial");

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setEstado("enviando");
    const { error } = await authCliente.requestPasswordReset({ email, redirectTo: "/restablecer" });
    // Siempre se muestra el mismo mensaje, exista o no el mail.
    setEstado(error?.status === 429 ? "error" : "enviado");
  }

  return (
    <>
      <h1 className="text-grande font-bold">Elegí una contraseña nueva</h1>
      <p className="mt-2 text-pizarra-suave">
        Te mandamos un enlace a tu mail para cambiarla. Vence en una hora.
      </p>
      {estado === "enviado" ? (
        <div className="mt-6 flex flex-col gap-5">
          <Aviso tono="ok">
            Si el mail está registrado, en unos minutos te llega el enlace. Revisá también la
            carpeta de correo no deseado.
          </Aviso>
          <Link href="/ingresar" className="self-start py-2 underline underline-offset-4">
            Volver a ingresar
          </Link>
        </div>
      ) : (
        <form onSubmit={alEnviar} className="mt-6 flex flex-col gap-5" noValidate>
          {estado === "error" && (
            <Aviso tono="error">Hubo demasiados intentos. Esperá un minuto y probá de nuevo.</Aviso>
          )}
          <Campo etiqueta="Mail" name="email" type="email" autoComplete="email" inputMode="email" required />
          <Boton type="submit" disabled={estado === "enviando"}>
            {estado === "enviando" ? "Enviando…" : "Mandarme el enlace"}
          </Boton>
          <Link href="/ingresar" className="self-start py-2 underline underline-offset-4">
            Volver a ingresar
          </Link>
        </form>
      )}
    </>
  );
}
