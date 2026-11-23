/** Solicitudes de ejemplo (datos ficticios), con una respuesta y una nota interna. */
import type { PrismaClient } from "../src/generated/prisma/client";

export async function sembrarSolicitudes(db: PrismaClient) {
  // Número de WhatsApp inventado (decisión 19).
  await db.configuracion.update({ where: { id: 1 }, data: { whatsapp: "59899000000" } });
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
  const porteria = await db.user.findUniqueOrThrow({ where: { email: "porteria@example.com" } });
  const duenos = await db.persona.findMany({
    where: { activa: true, calidad: { not: "INQUILINO" }, unidad: { tipo: "APTO" } },
    select: { unidadId: true, userId: true },
    orderBy: { createdAt: "asc" },
    skip: 4,
    take: 2,
  });

  const d1 = await db.solicitud.create({
    data: {
      unidadId: duenos[0].unidadId,
      autorId: duenos[0].userId!,
      categoria: "DESPERFECTO",
      asunto: "No funciona la luz del palier del 3er piso",
      texto: "Desde ayer la luz del palier no prende. Queda todo oscuro de noche.",
      estado: "EN_CURSO",
    },
  });
  await db.solicitudEvento.createMany({
    data: [
      { solicitudId: d1.id, autorId: admin.id, tipo: "RESPUESTA", texto: "Gracias por avisar. Mañana pasa el electricista." },
      { solicitudId: d1.id, autorId: admin.id, tipo: "CAMBIO_ESTADO", texto: "Pasó de nueva a en curso." },
      { solicitudId: d1.id, autorId: admin.id, tipo: "NOTA_INTERNA", texto: "Pedido al electricista de prueba." },
    ],
  });
  await db.solicitud.create({
    data: {
      unidadId: duenos[1].unidadId,
      autorId: duenos[1].userId!,
      categoria: "CONSULTA_GC",
      asunto: "Consulta por el saldo de setiembre",
      texto: "Pagué el 5 de setiembre y me figura saldo pendiente.",
    },
  });
  await db.solicitud.create({
    data: {
      autorId: porteria.id,
      categoria: "DESPERFECTO",
      origen: "PORTERIA_PROPIA",
      asunto: "Se trabó el portón del garaje",
      texto: "El portón del garaje se trabó a mitad de camino. Lo dejé abierto a mano.",
    },
  });
  return 3;
}
