/**
 * Seed de desarrollo con datos 100% FICTICIOS (nombres inventados, mails @example.com).
 * Nunca usar datos reales del edificio acá.
 *
 * Crea: 4 torres + sector garajes, ~10 unidades por torre (algunas arrendadas),
 * personas, y usuarios para cada rol. Todos con la contraseña SEED_PASSWORD.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Calidad, type Rol } from "../src/generated/prisma/client";
import { limpiarLiquidacion, sembrarLiquidacion } from "./seed-liquidacion";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const CLAVE = process.env.SEED_PASSWORD;
if (!CLAVE || CLAVE.length < 10) {
  throw new Error("Definí SEED_PASSWORD (mínimo 10 caracteres) en .env antes de correr el seed.");
}

const NOMBRES = [
  "Laura", "Martín", "Valentina", "Diego", "Florencia", "Santiago", "Camila", "Federico",
  "Lucía", "Gonzalo", "Sofía", "Nicolás", "Agustina", "Joaquín", "Carolina", "Matías",
  "Josefina", "Rodrigo", "Micaela", "Andrés", "Paula", "Sebastián", "Natalia", "Ignacio",
];
const APELLIDOS = [
  "Pereira", "Rodríguez", "Fernández", "Silva", "Martínez", "Sosa", "Núñez", "Olivera",
  "Acosta", "Méndez", "Cabrera", "Suárez", "Viera", "Ferreira", "Píriz", "Techera",
];

let contador = 0;
function personaFicticia() {
  const nombre = NOMBRES[contador % NOMBRES.length];
  const apellido = APELLIDOS[(contador * 7) % APELLIDOS.length];
  contador++;
  const email = `${nombre}.${apellido}.${contador}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .concat("@example.com");
  const telefono = `09${(1000000 + ((contador * 7919) % 8999999)).toString().padStart(7, "0")}`;
  return { nombre: `${nombre} ${apellido}`, email, telefono };
}

let hashClave: string;

/** Los responsables del seed figuran desde antes de la primera liquidación de ejemplo. */
const ALTA = new Date(Date.UTC(2025, 0, 1));

async function crearUsuario(nombre: string, email: string, rol: Rol) {
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: nombre,
      email,
      emailVerified: true,
      rol,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: "credential", password: hashClave },
      },
    },
  });
  return id;
}

async function main() {
  hashClave = await hashPassword(CLAVE!);

  // Limpieza (solo desarrollo)
  await db.auditoria.deleteMany();
  await db.solicitud.deleteMany();
  await limpiarLiquidacion(db);
  await db.destinatarioExtra.deleteMany();
  await db.persona.deleteMany();
  await db.unidad.deleteMany();
  await db.torre.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();

  await db.torre.createMany({
    data: [
      { codigo: 2, nombre: "Avenue", orden: 1 },
      { codigo: 3, nombre: "Sky", orden: 2 },
      { codigo: 4, nombre: "Pilay", orden: 3 },
      { codigo: 5, nombre: "NE", orden: 4 },
      { codigo: 6, nombre: "Garajes", tipo: "SECTOR", orden: 5 },
    ],
  });

  // Usuarios de gestión
  await crearUsuario("Administración", "admin@example.com", "ADMINISTRACION");
  await crearUsuario("Portería", "porteria@example.com", "PORTERIA");
  await crearUsuario("Comisión (sin unidad)", "comision@example.com", "COMISION");

  // Unidades: pisos 1 a 5, 2 por piso → 10 por torre
  let indice = 0;
  for (const torre of [2, 3, 4, 5]) {
    for (let piso = 1; piso <= 5; piso++) {
      for (const letra of [1, 2]) {
        const numero = `${piso}0${letra}`;
        const arrendada = indice % 3 === 1; // ~1 de cada 3 alquilada
        const unidad = await db.unidad.create({
          data: { torreId: torre, numero, arrendada, etiqueta: `Apto ${numero}` },
        });
        const duenio = personaFicticia();
        const calidad: Calidad = indice % 5 === 0 ? "PROMITENTE" : "PROPIETARIO";
        const userDuenio = await crearUsuario(duenio.nombre, duenio.email, "UNIDAD");
        // ~3 de cada 4 ya confirmaron sus datos; el resto ve el aviso para revisarlos.
        const confirmado = indice % 4 !== 3 ? new Date() : null;
        await db.persona.create({
          data: { unidadId: unidad.id, calidad, ...duenio, userId: userDuenio, datosConfirmadosEn: confirmado, altaEn: ALTA },
        });
        if (arrendada) {
          const inq = personaFicticia();
          const userInq = await crearUsuario(inq.nombre, inq.email, "UNIDAD");
          await db.persona.create({
            data: { unidadId: unidad.id, calidad: "INQUILINO", ...inq, userId: userInq, datosConfirmadosEn: new Date(), altaEn: ALTA },
          });
        }
        indice++;
      }
    }
  }

  // Garajes sueltos, de dueños que ya tienen apartamento (un usuario, varias unidades)
  const duenios = await db.persona.findMany({
    where: { calidad: { not: "INQUILINO" } },
    take: 4,
    orderBy: { createdAt: "asc" },
  });
  for (const [i, d] of duenios.entries()) {
    const garaje = await db.unidad.create({
      data: { torreId: 6, numero: String(i + 1).padStart(3, "0"), tipo: "GARAJE", etiqueta: `Garaje ${i + 1}` },
    });
    await db.persona.create({
      data: {
        unidadId: garaje.id,
        calidad: d.calidad,
        nombre: d.nombre,
        telefono: d.telefono,
        email: d.email,
        userId: d.userId,
        datosConfirmadosEn: d.datosConfirmadosEn,
        altaEn: ALTA,
      },
    });
  }

  // Un miembro de la Comisión que además vive en el edificio
  const primerDuenio = duenios[0];
  await db.user.update({ where: { id: primerDuenio.userId! }, data: { rol: "COMISION" } });

  const lineas = await sembrarLiquidacion(db);
  console.log(`Liquidación de setiembre 2026 publicada con ${lineas} líneas (octubre queda para preparar).`);

  const [unidades, personas, usuarios] = await Promise.all([
    db.unidad.count(),
    db.persona.count(),
    db.user.count(),
  ]);
  console.log(`Seed listo: ${unidades} unidades, ${personas} personas, ${usuarios} usuarios.`);
  console.log(`Usuarios de prueba: admin@example.com, porteria@example.com, comision@example.com,`);
  console.log(`y ${primerDuenio.email} (Comisión + propietario). Clave: la de SEED_PASSWORD en .env.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
