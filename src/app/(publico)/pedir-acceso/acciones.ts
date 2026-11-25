"use server";
import { pedirAcceso } from "@/servidor/accesos";
import type { Resultado } from "@/servidor/resultado";

export type Estado = Resultado | null;

const CAMPOS = ["nombre", "email", "telefono", "codigo", "calidad", "mensaje", "acepto", "sitio"];

export async function accionPedirAcceso(_: Estado, fd: FormData) {
  return pedirAcceso(Object.fromEntries(CAMPOS.map((n) => [n, fd.get(n) ?? undefined])));
}
