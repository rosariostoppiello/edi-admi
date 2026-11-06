import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/componentes/ui/aviso";
import { FormRestablecer } from "./form";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function PaginaRestablecer({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; bienvenida?: string }>;
}) {
  const { token, error, bienvenida } = await searchParams;

  if (!token || error) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-grande font-bold">El enlace ya no sirve</h1>
        <Aviso tono="error">
          {bienvenida
            ? "La invitación venció o ya se usó. Pedí un enlace nuevo con tu mail."
            : "El enlace venció o ya se usó. Pedí uno nuevo y usalo dentro de la hora."}
        </Aviso>
        <Link href="/recuperar" className="self-start py-2 underline underline-offset-4">
          Pedir un enlace nuevo
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-grande font-bold">{bienvenida ? "Creá tu contraseña" : "Elegí tu contraseña nueva"}</h1>
      <p className="mt-2 text-pizarra-suave">
        {bienvenida
          ? "Con tu mail y esta contraseña vas a entrar al sistema. Usá al menos 10 caracteres."
          : "Usá al menos 10 caracteres."}
      </p>
      <FormRestablecer token={token} bienvenida={Boolean(bienvenida)} />
    </>
  );
}
