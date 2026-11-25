import type { Metadata } from "next";
import { connection } from "next/server";
import { edificiosActivos } from "@/servidor/edificios";
import { accionPedirAcceso, accionVerificarPedido } from "./acciones";
import { FormPedirAcceso } from "./form";

export const metadata: Metadata = { title: "Pedir acceso" };

export default async function PaginaPedirAcceso() {
  // Los edificios se leen en cada visita (no al compilar).
  await connection();
  const edificios = await edificiosActivos();
  return (
    <>
      <h1 className="text-grande font-bold">Pedí tu usuario</h1>
      <p className="mt-2 text-pizarra-suave">
        Completá tus datos y confirmá tu mail con el código que te mandamos. La Administración comprueba que sos de la unidad y te llega un mail para crear tu contraseña.
      </p>
      <FormPedirAcceso accion={accionPedirAcceso} verificar={accionVerificarPedido} edificios={edificios.length > 1 ? edificios : []} />
    </>
  );
}
