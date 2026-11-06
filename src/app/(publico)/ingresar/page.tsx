import type { Metadata } from "next";
import { FormIngresar } from "./form";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaIngresar() {
  return (
    <>
      <h1 className="text-grande font-bold">Ingresá con tu mail</h1>
      <p className="mt-2 text-pizarra-suave">
        Usá el mail que tenés registrado en la administración.
      </p>
      <FormIngresar />
    </>
  );
}
