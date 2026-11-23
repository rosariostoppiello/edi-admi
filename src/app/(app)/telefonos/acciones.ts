"use server";
import { revalidatePath } from "next/cache";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as tel from "@/servidor/telefonos";

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

const todo = (fd: FormData) => Object.fromEntries([...fd.keys()].filter((k) => !k.startsWith("$")).map((k) => [k, fd.get(k) ?? undefined]));

export async function accionFicha(clave: tel.ClaveFicha, _: Estado, fd: FormData) {
  return ejecutar(() => tel.guardarFicha(clave, todo(fd)));
}
export async function accionContacto(tipo: tel.TipoContacto, id: string | null, _: Estado, fd: FormData) {
  return ejecutar(() => tel.guardarContacto(tipo, id, todo(fd)));
}
export async function accionBorrarContacto(id: string, _: Estado) {
  return ejecutar(() => tel.borrarContacto(id));
}
export async function accionPoliza(id: string | null, _: Estado, fd: FormData) {
  return ejecutar(() => tel.guardarPoliza(id, todo(fd)));
}
