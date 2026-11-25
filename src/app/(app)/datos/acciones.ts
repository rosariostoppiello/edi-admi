"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorPermiso } from "@/dominio/permisos";
import * as datos from "@/servidor/datos";
import { aprobarPedido, rechazarPedido } from "@/servidor/accesos";
import { exigirUsuario } from "@/servidor/sesion";
import { elegirUnidadActiva } from "@/servidor/unidad-activa";

export type Estado = datos.Resultado | null;

/** Ejecuta un servicio y convierte la falta de permiso en un mensaje (no en un 500). */
async function ejecutar<T extends datos.Resultado>(fn: () => Promise<T>): Promise<T | datos.Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

function campos(fd: FormData, nombres: string[]) {
  return Object.fromEntries(nombres.map((n) => [n, fd.get(n) ?? undefined]));
}

export async function accionEditarPersona(unidadId: string, personaId: string, _: Estado, fd: FormData) {
  return ejecutar(() =>
    datos.editarPersona(unidadId, personaId, {
      ...campos(fd, ["nombre", "apellido", "telefono", "email"]),
      calidad: fd.get("calidad") || undefined,
    }),
  );
}

export async function accionConfirmarSinAlquilar(unidadId: string, personaId: string, _: Estado) {
  return ejecutar(() => datos.confirmarSinAlquilar(unidadId, personaId));
}

export async function accionAltaInquilino(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => datos.altaInquilino(unidadId, campos(fd, ["nombre", "apellido", "telefono", "email"])));
}

export async function accionBajaInquilino(unidadId: string, personaId: string, _: Estado) {
  const r = await ejecutar(() => datos.bajaInquilino(unidadId, personaId));
  // Si el inquilino se dio de baja a sí mismo, ya no tiene acceso a esta unidad.
  if (r.ok && "cerroSuSesion" in r && r.cerroSuSesion) redirect("/ingresar");
  return r;
}

export async function accionAgregarDestinatario(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => datos.agregarDestinatario(unidadId, campos(fd, ["email", "nombre"])));
}

export async function accionQuitarDestinatario(unidadId: string, destinatarioId: string, _: Estado) {
  return ejecutar(() => datos.quitarDestinatario(unidadId, destinatarioId));
}

export async function accionCambiarPropietario(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => datos.cambiarPropietario(unidadId, campos(fd, ["nombre", "apellido", "telefono", "email", "calidad"])));
}

export async function accionAvisarVenta(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => datos.avisarVenta(unidadId, campos(fd, ["nombre", "apellido", "telefono", "email", "calidad", "comentario"])));
}

export async function accionConfirmarVenta(unidadId: string, _: Estado) {
  return ejecutar(() => datos.confirmarVenta(unidadId));
}

export async function accionRechazarVenta(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => datos.rechazarVenta(unidadId, campos(fd, ["motivo"])));
}

export async function accionReenviarInvitacion(unidadId: string, personaId: string, _: Estado) {
  return ejecutar(() => datos.reenviarInvitacion(unidadId, personaId));
}

export async function accionCrearUnidad(_: Estado, fd: FormData) {
  const r = await ejecutar(() =>
    datos.crearUnidad(campos(fd, ["torreId", "numero", "tipo", "etiqueta", "calidad", "nombre", "apellido", "telefono", "email"])),
  );
  if (r.ok && "unidadId" in r && r.unidadId) redirect(`/datos/${r.unidadId}?creada=1`);
  return r;
}

/** Cambia la unidad activa (usuarios con varias unidades). */
export async function accionElegirUnidad(fd: FormData) {
  const usuario = await exigirUsuario();
  const unidadId = String(fd.get("unidadId") ?? "");
  await elegirUnidadActiva(usuario, unidadId);
  revalidatePath("/", "layout");
  const volverA = String(fd.get("volverA") ?? "/");
  redirect(volverA.startsWith("/") && !volverA.startsWith("//") ? volverA : "/");
}

// Pedidos de acceso (decisión 84)
export async function accionAprobarPedido(id: string) {
  return ejecutar(() => aprobarPedido(id));
}
export async function accionRechazarPedido(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => rechazarPedido(id, campos(fd, ["motivo"])));
}
