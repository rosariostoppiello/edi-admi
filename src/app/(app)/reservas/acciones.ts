"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as reservas from "@/servidor/reservas";

export type Estado = Resultado | null;

async function ejecutar<T extends Resultado>(fn: () => Promise<T>): Promise<T | Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/reservas", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

const campos = (fd: FormData, nombres: string[]) => Object.fromEntries(nombres.map((n) => [n, fd.get(n) ?? undefined]));

export async function accionReservar(_: Estado, fd: FormData) {
  const r = await ejecutar(() => reservas.reservar(campos(fd, ["espacioId", "fecha", "turno", "codigo", "pedidaPor"])));
  if (r.ok && "reservaId" in r && r.reservaId) redirect(`/reservas/barbacoas?desde=${fd.get("fecha")}&reservada=1`);
  return r;
}

export async function accionCancelar(reservaId: string, _: Estado) {
  return ejecutar(() => reservas.cancelar(reservaId));
}

export async function accionGuardarEspacio(espacioId: string, _: Estado, fd: FormData) {
  return ejecutar(() =>
    reservas.guardarEspacio(espacioId, campos(fd, ["nombre", "tarifa", "descripcion", "activo", "anticipacionDias", "maxActivasPorUnidad", "horasCancelacion"])),
  );
}

export async function accionCrearEspacio(_: Estado, fd: FormData) {
  return ejecutar(() => reservas.crearEspacio(campos(fd, ["nombre", "tipo", "torreId", "barbacoaId", "tarifa"])));
}
