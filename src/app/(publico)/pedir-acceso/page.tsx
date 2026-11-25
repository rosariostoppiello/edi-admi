import type { Metadata } from "next";
import { accionPedirAcceso } from "./acciones";
import { FormPedirAcceso } from "./form";

export const metadata: Metadata = { title: "Pedir acceso" };

export default function PaginaPedirAcceso() {
  return (
    <>
      <h1 className="text-grande font-bold">Pedí tu usuario</h1>
      <p className="mt-2 text-pizarra-suave">
        Completá tus datos. La Administración comprueba que sos de la unidad y te llega un mail para crear tu contraseña.
      </p>
      <FormPedirAcceso accion={accionPedirAcceso} />
    </>
  );
}
