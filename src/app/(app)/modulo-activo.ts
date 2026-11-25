import "server-only";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { moduloPrendido } from "./modulos";

/** Para el layout de cada módulo: si el edificio lo tiene apagado, la sección no existe. */
export async function exigirModulo(ruta: string) {
  const usuario = await exigirUsuario();
  if (!moduloPrendido(usuario.edificio.modulos, ruta)) notFound();
}
