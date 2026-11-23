"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ErrorPermiso } from "@/dominio/permisos";
import type { Resultado } from "@/servidor/resultado";
import * as conf from "@/servidor/liquidacion/confeccion";
import * as imp from "@/servidor/liquidacion/importar";
import * as pub from "@/servidor/liquidacion/publicar";

export type Estado = Resultado | null;

async function ejecutar<T extends Resultado>(fn: () => Promise<T>): Promise<T | Resultado> {
  try {
    const r = await fn();
    if (r.ok) revalidatePath("/liquidaciones", "layout");
    return r;
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
    throw e;
  }
}

const campos = (fd: FormData, nombres: string[]) => Object.fromEntries(nombres.map((n) => [n, fd.get(n) ?? undefined]));

// Crear / eliminar
export async function accionCrear(_: Estado, fd: FormData) {
  const r = await ejecutar(() => conf.crearLiquidacion({ periodo: String(fd.get("periodo") ?? "") || undefined }));
  if (r.ok && "id" in r && r.id) redirect(`/liquidaciones/confeccion/${r.id}/ingresos`);
  return r;
}
export async function accionEliminarBorrador(id: string, _: Estado) {
  const r = await ejecutar(() => conf.eliminarBorrador(id));
  if (r.ok) redirect("/liquidaciones/confeccion");
  return r;
}

// Ingresos
export async function accionAgregarIngreso(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.agregarIngreso(id, campos(fd, ["codigo", "fecha", "monto", "referencia"])));
}
export async function accionEliminarIngreso(id: string, ingresoId: string, _: Estado) {
  return ejecutar(() => conf.eliminarIngreso(id, ingresoId));
}
export async function accionSubirPlanilla(id: string, tipo: "INGRESOS" | "SALDOS_INICIALES", _: Estado, fd: FormData) {
  return ejecutar(() => imp.subirPlanilla(id, tipo, fd.get("archivo")));
}
export async function accionConfirmarImportacion(id: string, importacionId: string, _: Estado) {
  return ejecutar(() => imp.confirmarImportacion(id, importacionId));
}
export async function accionDescartarImportacion(id: string, importacionId: string, _: Estado) {
  return ejecutar(() => imp.descartarImportacion(id, importacionId));
}

// Depósitos no identificados
export async function accionCargarDeposito(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.cargarDeposito(id, campos(fd, ["fecha", "forma", "documento", "monto"])));
}
export async function accionIdentificarDeposito(id: string, depositoId: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.identificarDeposito(id, depositoId, campos(fd, ["codigo"])));
}
export async function accionEliminarDeposito(id: string, depositoId: string, _: Estado) {
  return ejecutar(() => conf.eliminarDeposito(id, depositoId));
}

// Egresos
const CAMPOS_EGRESO = ["rubroId", "fecha", "proveedor", "detalle", "monto"];
export async function accionAgregarEgreso(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.agregarEgreso(id, campos(fd, [...CAMPOS_EGRESO, "fijo"])));
}
export async function accionEditarEgreso(id: string, egresoId: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.editarEgreso(id, egresoId, campos(fd, CAMPOS_EGRESO)));
}
export async function accionEliminarEgreso(id: string, egresoId: string, _: Estado) {
  return ejecutar(() => conf.eliminarEgreso(id, egresoId));
}
export async function accionDesactivarFijo(fijoId: string, _: Estado) {
  return ejecutar(() => conf.desactivarEgresoFijo(fijoId));
}
export async function accionAgregarRubro(_: Estado, fd: FormData) {
  return ejecutar(() => conf.agregarRubro(campos(fd, ["codigo", "nombre", "cargoPropietario"])));
}

// Cargos
export async function accionAgregarCargo(id: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.agregarCargo(id, campos(fd, ["codigo", "tipo", "concepto", "monto"])));
}
export async function accionEliminarCargo(id: string, cargoId: string, _: Estado) {
  return ejecutar(() => conf.eliminarCargo(id, cargoId));
}

// Cuotas
export async function accionGuardarCuotas(unidadId: string, _: Estado, fd: FormData) {
  return ejecutar(() => conf.guardarCuotas(unidadId, campos(fd, ["gcUnidad", "gcPropietario", "gcGaraje", "cuotaExtraFr", "garajeACargoDe"])));
}

// Fondos y parámetros
export async function accionGuardarParametros(id: string, _: Estado, fd: FormData) {
  return ejecutar(() =>
    conf.guardarParametros(id, campos(fd, ["tasaInteres", "tasaFondoReserva", "diaVencimiento", "procedimientoPago", "guardarComoPredeterminado"])),
  );
}
export async function accionGuardarDisponibilidades(id: string, _: Estado, fd: FormData) {
  let datos: unknown;
  try {
    datos = JSON.parse(String(fd.get("datos") ?? "{}"));
  } catch {
    return { ok: false, error: "Los datos de las cuentas no son válidos." } satisfies Resultado;
  }
  return ejecutar(() => conf.guardarDisponibilidades(id, datos));
}

// Publicar / anular / reenviar
export async function accionPublicar(id: string, _: Estado) {
  const r = await ejecutar(() => pub.publicarLiquidacion(id));
  if (r.ok && "periodo" in r && r.periodo) redirect(`/liquidaciones/${r.periodo}?publicada=1`);
  return r;
}
export async function accionAnular(id: string, _: Estado, fd: FormData) {
  const r = await ejecutar(() => pub.anularLiquidacion(id, campos(fd, ["motivo"])));
  if (r.ok && "borradorId" in r && r.borradorId) redirect(`/liquidaciones/confeccion/${r.borradorId}/revision?rectificacion=1`);
  return r;
}
export async function accionReintentarEnvios(id: string, _: Estado) {
  return ejecutar(() => pub.reintentarEnvios(id));
}
