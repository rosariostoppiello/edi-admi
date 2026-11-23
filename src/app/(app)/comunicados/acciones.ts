"use server";
import { revalidatePath } from "next/cache";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as com from "@/servidor/comunicados";

export type Estado = Resultado | null;

async function ejecutar(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/comunicados", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

const campos = (fd: FormData) => Object.fromEntries(["titulo", "fecha", "cuerpo", "enviar", "archivo"].map((n) => [n, fd.get(n) ?? undefined]));

export async function accionPublicar(slug: string, _: Estado, fd: FormData) {
  return ejecutar(() => com.publicarComunicado(slug, campos(fd)));
}
export async function accionEditar(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => com.editarComunicado(id, campos(fd)));
}
export async function accionBaja(id: string, _: Estado) {
  return ejecutar(() => com.darDeBaja(id));
}
export async function accionMover(id: string, direccion: "arriba" | "abajo", _: Estado) {
  return ejecutar(() => com.moverReglamento(id, direccion));
}
export async function accionReintentar(id: string, _: Estado) {
  return ejecutar(() => com.reintentarEnvios(id));
}
