"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/servidor/auth";

export async function salir() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/ingresar");
}
