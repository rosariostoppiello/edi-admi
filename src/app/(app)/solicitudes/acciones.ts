"use server";
import { revalidatePath } from "next/cache";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as sol from "@/servidor/solicitudes";

export type Estado = Resultado | null;

async function ejecutar<T extends Resultado>(fn: () => Promise<T>): Promise<T | Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/solicitudes", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

const campos = (fd: FormData, nombres: string[]) => Object.fromEntries(nombres.map((n) => [n, fd.get(n) ?? undefined]));

export async function accionCrear(slug: string, _: Estado, fd: FormData) {
  return ejecutar(() => sol.crearSolicitud(slug, campos(fd, ["asunto", "texto", "origen", "codigo", "pedidaPor"])));
}
export async function accionResponder(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => sol.responder(id, campos(fd, ["texto", "resuelta"])));
}
export async function accionNota(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => sol.agregarNota(id, campos(fd, ["texto"])));
}
export async function accionEstado(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => sol.cambiarEstado(id, campos(fd, ["estado"])));
}
export async function accionWhatsapp(_: Estado, fd: FormData) {
  return ejecutar(() => sol.guardarWhatsapp(campos(fd, ["whatsapp"])));
}
