/**
 * Crea (o reactiva) un usuario de Administración en una base vacía de producción,
 * sin el seed ficticio. No pone contraseña: la persona entra a /ingresar, toca
 * "Me olvidé la contraseña" y crea la suya con el enlace que le llega por mail.
 *
 *   DATABASE_URL=... npx tsx scripts/crear-admin.ts "Nombre Apellido" mail@dominio
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [nombre, email] = process.argv.slice(2);
if (!nombre || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Uso: npx tsx scripts/crear-admin.ts "Nombre Apellido" mail@dominio');
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const correo = email.toLowerCase();
  const u = await db.user.upsert({
    where: { email: correo },
    create: { id: randomUUID(), name: nombre, email: correo, rol: "ADMINISTRACION", emailVerified: true },
    update: { rol: "ADMINISTRACION", activo: true },
  });
  // Base vacía: crea el primer edificio (decisión 85).
  const edificio =
    (await db.edificio.findFirst({ orderBy: { creadoEn: "asc" } })) ??
    (await db.edificio.create({ data: { id: "edificio-principal", nombre: process.env.EDIFICIO_NOMBRE || "Complejo" } }));
  await db.configuracion.upsert({ where: { edificioId: edificio.id }, create: { edificioId: edificio.id }, update: {} });
  await db.auditoria.create({ data: { accion: "usuario.admin_creado", entidad: "user", entidadId: u.id, detalle: { origen: "scripts/crear-admin.ts" } } });
  console.log(`Listo: ${correo} es Administración. Para crear su contraseña: /ingresar → "Me olvidé la contraseña".`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
