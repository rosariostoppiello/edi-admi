"use server";
import { pedirAcceso, verificarPedido, type ResultadoPedido } from "@/servidor/accesos";

export type Estado = ResultadoPedido | null;

const CAMPOS = ["nombre", "apellido", "email", "telefono", "codigo", "calidad", "mensaje", "acepto", "sitio", "edificioId"];

export async function accionPedirAcceso(_: Estado, fd: FormData) {
  return pedirAcceso(Object.fromEntries(CAMPOS.map((n) => [n, fd.get(n) ?? undefined])));
}

export async function accionVerificarPedido(_: Estado, fd: FormData) {
  return verificarPedido({ pedidoId: fd.get("pedidoId") ?? undefined, codigoVerificacion: fd.get("codigoVerificacion") ?? undefined });
}
