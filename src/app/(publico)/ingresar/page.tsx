import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { enlaceWhatsapp } from "@/dominio/solicitudes";
import { contactoAdministracion } from "@/servidor/accesos";
import { FormIngresar } from "./form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function PaginaIngresar() {
  // El contacto se lee en cada visita (no al compilar).
  await connection();
  const contacto = await contactoAdministracion();
  return (
    <>
      <h1 className="text-grande font-bold">Ingresá con tu mail</h1>
      <p className="mt-2 text-pizarra-suave">
        Usá el mail que tenés registrado en la administración.
      </p>
      <FormIngresar />

      <section aria-labelledby="sin-usuario" className="mt-10 flex flex-col gap-3 border-t border-junta pt-6">
        <h2 id="sin-usuario" className="text-medio font-bold">
          ¿No tenés usuario?
        </h2>
        <p>Pedíselo a la Administración: completá tus datos y te llega un mail para crear tu contraseña.</p>
        <Link
          href="/pedir-acceso"
          className="inline-flex min-h-12 items-center justify-center self-start rounded-[var(--radius-campo)] border-2 border-pizarra bg-losa px-5 font-bold hover:bg-granito"
        >
          Pedir acceso
        </Link>
        {(contacto.whatsapp || contacto.mail) && (
          <p className="text-pizarra-suave">
            También podés escribirle a la Administración
            {contacto.whatsapp && (
              <>
                {" "}por{" "}
                <a
                  href={enlaceWhatsapp(contacto.whatsapp, { categoria: "Acceso al sistema", asunto: "Quiero mi usuario" })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-pizarra underline underline-offset-4 hover:text-bronce-texto"
                >
                  WhatsApp
                </a>
              </>
            )}
            {contacto.whatsapp && contacto.mail && " o"}
            {contacto.mail && (
              <>
                {" "}a{" "}
                <a href={`mailto:${contacto.mail}`} className="font-bold text-pizarra underline underline-offset-4 hover:text-bronce-texto">
                  {contacto.mail}
                </a>
              </>
            )}
            .
          </p>
        )}
      </section>
    </>
  );
}
