/** Teléfonos y datos de interés de ejemplo (todo inventado). */
import type { PrismaClient } from "../src/generated/prisma/client";
import { fechaUy, sumarDias } from "../src/dominio/reservas";

export async function limpiarTelefonos(db: PrismaClient) {
  await db.contacto.deleteMany();
  await db.fichaContacto.deleteMany();
  await db.poliza.deleteMany();
}

export async function sembrarTelefonos(db: PrismaClient) {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
  await db.fichaContacto.createMany({
    data: [
      {
        clave: "ADMINISTRACION",
        datos: {
          nombre: "Administración de Prueba",
          mail: "admin@example.com",
          direccion: "Calle Ficticia 1234, oficina 5",
          celulares: "099 000 001 / 099 000 002",
          horario: "Lunes a viernes de 10 a 17 h",
        },
      },
      { clave: "PORTERIA", datos: { empresa: "Portería de Prueba SRL", telefono: "2900 0000", horario: "Todos los días, las 24 horas" } },
    ],
  });
  const ahora = new Date();
  await db.contacto.createMany({
    data: [
      { tipo: "COMISION", nombre: "Integrante Uno", detalle: "Presidente", unidad: "2-101", telefono: "099 100 100", consentimientoEn: ahora, consentimientoRegistradoPorId: admin.id, orden: 1 },
      { tipo: "COMISION", nombre: "Integrante Dos", detalle: "Tesorera", unidad: "3-201", telefono: "099 200 200", consentimientoEn: ahora, consentimientoRegistradoPorId: admin.id, orden: 2 },
      // Sin consentimiento: solo lo ve la Administración.
      { tipo: "COMISION", nombre: "Integrante Tres", detalle: "Vocal", unidad: "4-301", telefono: "099 300 300", orden: 3 },
      { tipo: "EMPRESA", nombre: "Ascensores de Prueba", detalle: "Ascensores", telefono: "2600 0001", orden: 1 },
      { tipo: "EMPRESA", nombre: "Limpieza de Prueba", detalle: "Limpieza", telefono: "2600 0002", orden: 2 },
      { tipo: "EMPRESA", nombre: "Sanitaria de Prueba", detalle: "Sanitaria", telefono: "099 600 003", orden: 3 },
      { tipo: "EMPRESA", nombre: "Bombas de Prueba", detalle: "Bombas de agua", telefono: "2600 0004 / 099 600 004", orden: 4 },
      { tipo: "SERVICIO", nombre: "UTE espacios comunes", detalle: "Calle Ficticia 1234", cuenta: "0000000001", titular: "Complejo de Prueba", orden: 1 },
      { tipo: "SERVICIO", nombre: "OSE", detalle: "Calle Ficticia 1234", cuenta: "0000000002", titular: "Complejo de Prueba", orden: 2 },
      { tipo: "SERVICIO", nombre: "Tarifa de saneamiento", detalle: "Calle Ficticia 1234", cuenta: "0000000003", titular: "Complejo de Prueba", orden: 3 },
    ],
  });
  // Vence en 20 días: se ve el aviso de vencimiento (decisión 70).
  const hoy = fechaUy(ahora);
  await db.poliza.create({
    data: {
      aseguradora: "Aseguradora de Prueba",
      numero: "POL-000123",
      cobertura: "Incendio de edificio y espacios comunes",
      telefono: "0800 0000",
      desde: new Date(`${sumarDias(hoy, -345)}T00:00:00Z`),
      hasta: new Date(`${sumarDias(hoy, 20)}T00:00:00Z`),
    },
  });
}
