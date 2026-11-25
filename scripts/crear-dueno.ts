/**
 * Marca a un usuario existente como dueño del sistema: aprueba los edificios nuevos
 * (decisión 86). El usuario tiene que existir (ej. creado con admin:crear).
 *
 *   DATABASE_URL=... npx tsx scripts/crear-dueno.ts mail@dominio
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const [email] = process.argv.slice(2);
if (!email) {
  console.error("Uso: npx tsx scripts/crear-dueno.ts mail@dominio");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const u = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!u) throw new Error("No existe un usuario con ese mail. Crealo primero con npm run admin:crear.");
  await db.user.update({ where: { id: u.id }, data: { duenoSistema: true } });
  await db.auditoria.create({ data: { accion: "usuario.dueno_sistema", entidad: "user", entidadId: u.id, detalle: { origen: "scripts/crear-dueno.ts" } } });
  console.log(`Listo: ${u.email} es dueño del sistema. Ve "Edificios del sistema" en su inicio.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
