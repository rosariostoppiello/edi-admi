/**
 * Espacios comunes y algunas reservas de ejemplo (datos ficticios).
 * Tarifa inventada: $U 800 por turno.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { REGLAS_POR_DEFECTO, fechaUy, sumarDias } from "../src/dominio/reservas";

const fecha = (f: string) => new Date(`${f}T00:00:00Z`);

export async function limpiarReservas(db: PrismaClient) {
  await db.reserva.deleteMany();
  await db.espacio.updateMany({ data: { barbacoaId: null } });
  await db.espacio.deleteMany();
}

export async function sembrarReservas(db: PrismaClient) {
  const barbacoas = [];
  for (const [i, [nombre, torreId]] of ([["Barbacoa Torre Avenue", 2], ["Barbacoa Torre Pilay", 4], ["Barbacoa Torre Sky", 3]] as const).entries()) {
    const b = await db.espacio.create({ data: { nombre, tipo: "BARBACOA", torreId, tarifa: 80000, reglas: REGLAS_POR_DEFECTO, orden: i + 1 } });
    await db.espacio.create({ data: { nombre: nombre.replace("Barbacoa", "Solarium"), tipo: "SOLARIUM", torreId, barbacoaId: b.id, orden: i + 4 } });
    barbacoas.push(b);
  }
  await db.espacio.create({
    data: {
      nombre: "Laundry",
      tipo: "LAUNDRY",
      orden: 7,
      descripcion:
        "El laundry funciona con tarjeta prepaga, con un sistema independiente: no se reserva.\n\nLa tarjeta se recarga en la Portería. Horario de uso: todos los días de 8 a 22 h.",
    },
  });

  // Reservas: dos en octubre (para traer a la liquidación) y dos próximas.
  const lineas = await db.persona.findMany({
    where: { activa: true, calidad: { not: "INQUILINO" }, unidad: { tipo: "APTO", arrendada: false } },
    select: { unidadId: true, userId: true },
    orderBy: { createdAt: "asc" },
    skip: 1, // la primera es del miembro de la Comisión
    take: 3,
  });
  const porteria = await db.user.findUniqueOrThrow({ where: { email: "porteria@example.com" } });
  const hoy = fechaUy(new Date());
  const datos = [
    { espacio: barbacoas[0], fecha: "2026-10-10", turno: "NOCHE", linea: lineas[0], origen: "UNIDAD" },
    { espacio: barbacoas[2], fecha: "2026-10-18", turno: "MEDIODIA", linea: lineas[1], origen: "PORTERIA_A_PEDIDO" },
    { espacio: barbacoas[1], fecha: sumarDias(hoy, 12), turno: "NOCHE", linea: lineas[2], origen: "UNIDAD" },
    { espacio: barbacoas[0], fecha: sumarDias(hoy, 20), turno: "MEDIODIA", linea: lineas[1], origen: "PORTERIA_A_PEDIDO" },
  ] as const;
  for (const d of datos) {
    await db.reserva.create({
      data: {
        espacioId: d.espacio.id,
        fecha: fecha(d.fecha),
        turno: d.turno,
        unidadId: d.linea.unidadId,
        sufijo: "A",
        origen: d.origen,
        creadaPorId: d.origen === "UNIDAD" ? d.linea.userId! : porteria.id,
        pedidaPor: d.origen === "UNIDAD" ? null : "Vecina De Prueba",
      },
    });
  }
  return datos.length;
}
