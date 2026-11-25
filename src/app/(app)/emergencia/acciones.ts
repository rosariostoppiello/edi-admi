"use server";
import { revalidatePath } from "next/cache";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as em from "@/servidor/emergencias";

export type Estado = Resultado | null;

async function ejecutar(fn: () => Promise<Resultado>): Promise<Resultado> {
  try {
    const r = await fn();
    // La franja de alerta está en la cabecera de todas las pantallas.
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso)
      return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

const campos = (fd: FormData, nombres: string[]) =>
  Object.fromEntries(nombres.map((n) => [n, fd.get(n) ?? undefined]));

export async function accionAvisar(_: Estado, fd: FormData) {
  return ejecutar(() =>
    em.avisarEmergencia(campos(fd, ["tipo", "lugar", "detalle", "confirmado"])),
  );
}
export async function accionAvisarATodos(id: string, _: Estado, fd: FormData) {
  return ejecutar(() =>
    em.avisarATodos(id, campos(fd, ["mensaje", "confirmado"])),
  );
}
export async function accionCerrar(id: string, _: Estado, fd: FormData) {
  return ejecutar(() =>
    em.cerrarEmergencia(id, campos(fd, ["estado", "nota"])),
  );
}
export async function accionReintentar(id: string) {
  return ejecutar(() => em.reintentarEnvios(id));
}
