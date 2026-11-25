import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "./auth";
import { db } from "./db";

/**
 * Busca o crea el usuario para un mail y lo deja activo.
 * Devuelve si hay que mandarle invitación (todavía no tiene contraseña).
 */
export async function vincularUsuario(
  tx: Prisma.TransactionClient,
  email: string,
  nombre: string,
): Promise<{ userId: string; necesitaInvitacion: boolean }> {
  const existente = await tx.user.findUnique({
    where: { email },
    select: { id: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
  });
  if (existente) {
    await tx.user.update({ where: { id: existente.id }, data: { activo: true } });
    return { userId: existente.id, necesitaInvitacion: existente.accounts.length === 0 };
  }
  const userId = randomUUID();
  await tx.user.create({ data: { id: userId, email, name: nombre, emailVerified: false } });
  return { userId, necesitaInvitacion: true };
}

/**
 * Manda la invitación: es el mismo enlace de "elegí tu contraseña" de Better Auth.
 * Para usuarios sin contraseña, `sendResetPassword` (servidor/auth.ts) usa el texto
 * de bienvenida y extiende el vencimiento a 7 días. Al usar el enlace se crea la
 * cuenta con contraseña.
 */
export async function enviarInvitacion(email: string): Promise<void> {
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: "/restablecer?bienvenida=1" },
  });
}

/**
 * Si un usuario sin rol de gestión se queda sin unidades activas, se desactiva y se
 * cierran sus sesiones (ya no tiene nada que ver en el sistema).
 */
export async function desactivarSiNoTieneUnidades(tx: Prisma.TransactionClient, userId: string | null) {
  if (!userId) return;
  // Quien tiene un rol de gestión en algún edificio sigue activo aunque no tenga unidades.
  if (await tx.membresia.count({ where: { userId } })) return;
  const activas = await tx.persona.count({ where: { userId, activa: true } });
  if (activas > 0) return;
  await tx.user.update({ where: { id: userId }, data: { activo: false } });
  await tx.session.deleteMany({ where: { userId } });
}

export async function tieneContrasena(userId: string): Promise<boolean> {
  return (await db.account.count({ where: { userId, providerId: "credential" } })) > 0;
}
