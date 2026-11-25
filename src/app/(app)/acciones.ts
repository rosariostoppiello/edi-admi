"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/servidor/auth";
import { exigirUsuario } from "@/servidor/sesion";
import { elegirEdificioActivo } from "@/servidor/edificio-activo";

export async function salir() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/ingresar");
}

/** Elige el edificio con el que trabajar (decisión 86) y va a su inicio. */
export async function elegirEdificio(edificioId: string) {
  const usuario = await exigirUsuario();
  await elegirEdificioActivo(usuario, edificioId);
  redirect("/inicio");
}
