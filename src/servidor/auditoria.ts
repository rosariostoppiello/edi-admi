import "server-only";
import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export interface EventoAuditoria {
  usuarioId?: string | null;
  accion: string; // ej. "liquidacion.publicada", "inquilino.baja"
  entidad: string;
  entidadId?: string | null;
  detalle?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Registra una acción sensible. Se puede pasar un cliente de transacción para
 * que la auditoría quede en la misma transacción que el cambio.
 */
export async function registrarAuditoria(
  evento: EventoAuditoria,
  tx: Prisma.TransactionClient = db,
): Promise<void> {
  await tx.auditoria.create({
    data: {
      usuarioId: evento.usuarioId ?? null,
      accion: evento.accion,
      entidad: evento.entidad,
      entidadId: evento.entidadId ?? null,
      detalle: evento.detalle,
      ip: evento.ip ?? null,
    },
  });
}
