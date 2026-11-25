"use server";
import { revalidatePath } from "next/cache";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as alta from "@/servidor/alta-edificios";

export type Estado = Resultado | null;

async function ejecutar(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

export async function accionSolicitarEdificio(_: Estado, fd: FormData) {
  return ejecutar(() => alta.solicitarEdificio({ nombre: fd.get("nombre") ?? undefined, direccion: fd.get("direccion") ?? undefined, torres: fd.get("torres") ?? undefined }));
}
export async function accionAprobarEdificio(id: string) {
  return ejecutar(() => alta.aprobarEdificio(id));
}
export async function accionRechazarEdificio(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => alta.rechazarEdificio(id, { motivo: fd.get("motivo") ?? undefined }));
}
export async function accionGuardarModulos(_: Estado, fd: FormData) {
  return ejecutar(() => alta.guardarModulos(fd.getAll("modulos").map(String)));
}
