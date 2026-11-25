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
import { limpiarReservas, sembrarReservas } from "./seed-reservas";
import { sembrarSolicitudes } from "./seed-solicitudes";
import { limpiarComunicados, sembrarComunicados } from "./seed-comunicados";
import { limpiarTelefonos, sembrarTelefonos } from "./seed-telefonos";
import { EDIFICIO, EDIFICIO_RAMBLA } from "./seed-edificio";

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

async function crearUsuario(nombre: string, email: string, rol: Rol, edificioId: string = EDIFICIO) {
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: nombre,
      email,
      emailVerified: true,
      // Administración, Comisión y Portería: rol por edificio (decisión 86).
      ...(rol !== "UNIDAD" ? { membresias: { create: { edificioId, rol } } } : {}),
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
  await db.emergencia.deleteMany();
  await db.pedidoAcceso.deleteMany();
  await db.solicitud.deleteMany();
  await limpiarComunicados(db);
  await limpiarTelefonos(db);
  await limpiarLiquidacion(db);
  await limpiarReservas(db);
  await db.destinatarioExtra.deleteMany();
  await db.persona.deleteMany();
  await db.unidad.deleteMany();
  await db.torre.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.verification.deleteMany();
  await db.user.deleteMany();
  await db.edificio.deleteMany();

  await db.edificio.create({ data: { id: EDIFICIO, nombre: process.env.EDIFICIO_NOMBRE || "Complejo", direccion: "Av. de Ejemplo 1234, Montevideo" } });
  // El código interno de la torre coincide con su número en el edificio principal.
  await db.torre.createMany({
    data: [
      { edificioId: EDIFICIO, codigo: 2, numero: 2, nombre: "Avenue", color: "var(--torre-avenue)", orden: 1 },
      { edificioId: EDIFICIO, codigo: 3, numero: 3, nombre: "Sky", color: "var(--torre-sky)", orden: 2 },
      { edificioId: EDIFICIO, codigo: 4, numero: 4, nombre: "Pilay", color: "var(--torre-pilay)", orden: 3 },
      { edificioId: EDIFICIO, codigo: 5, numero: 5, nombre: "NE", color: "var(--torre-ne)", orden: 4 },
      { edificioId: EDIFICIO, codigo: 6, numero: 6, nombre: "Garajes", color: "var(--torre-garajes)", tipo: "SECTOR", orden: 5 },
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
          data: { edificioId: EDIFICIO, torreId: torre, numero, arrendada, etiqueta: `Apto ${numero}` },
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
      data: { edificioId: EDIFICIO, torreId: 6, numero: String(i + 1).padStart(3, "0"), tipo: "GARAJE", etiqueta: `Garaje ${i + 1}` },
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
  await db.membresia.create({ data: { userId: primerDuenio.userId!, edificioId: EDIFICIO, rol: "COMISION" } });

  const lineas = await sembrarLiquidacion(db);
  console.log(`Liquidación de setiembre 2026 publicada con ${lineas} líneas (octubre queda para preparar).`);
  const reservas = await sembrarReservas(db);
  console.log(`Espacios comunes: 3 barbacoas con su solarium y el laundry; ${reservas} reservas de ejemplo.`);
  console.log(`${await sembrarSolicitudes(db)} solicitudes de ejemplo.`);
  console.log(`${await sembrarComunicados(db)} comunicados de ejemplo (avisos, reglamentos y un acta).`);
  await sembrarTelefonos(db);
  console.log("Teléfonos y datos de interés de ejemplo (la póliza vence en 20 días).");
  console.log(await sembrarRambla());

  const [unidades, personas, usuarios] = await Promise.all([
    db.unidad.count(),
    db.persona.count(),
    db.user.count(),
  ]);
  console.log(`Seed listo: ${unidades} unidades, ${personas} personas, ${usuarios} usuarios.`);
  console.log(`Usuarios de prueba: admin@example.com, porteria@example.com, comision@example.com,`);
  console.log(`y ${primerDuenio.email} (Comisión + propietario). Clave: la de SEED_PASSWORD en .env.`);
}

/**
 * Segundo edificio ficticio (decisión 85): una torre que también es la "2", para
 * comprobar que los códigos 2-101 de un edificio no se mezclan con los del otro.
 * Una vecina tiene apartamento en los dos edificios.
 */
async function sembrarRambla() {
  await db.edificio.create({ data: { id: EDIFICIO_RAMBLA, nombre: "Edificio Rambla", direccion: "Rambla de Ejemplo 500, Montevideo" } });
  const torre = await db.torre.create({ data: { edificioId: EDIFICIO_RAMBLA, numero: 2, nombre: "Única", color: "var(--torre-sky)", orden: 1 } });
  await db.configuracion.create({ data: { edificioId: EDIFICIO_RAMBLA, direccion: "Rambla de Ejemplo 500, Montevideo" } });
  for (const numero of ["101", "102", "201", "202"]) {
    const u = await db.unidad.create({ data: { edificioId: EDIFICIO_RAMBLA, torreId: torre.codigo, numero, etiqueta: `Apto ${numero}` } });
    const d = personaFicticia();
    const userId = await crearUsuario(d.nombre, d.email, "UNIDAD");
    await db.persona.create({ data: { unidadId: u.id, calidad: "PROPIETARIO", ...d, userId, datosConfirmadosEn: new Date(), altaEn: ALTA } });
  }
  // Administradora de los dos edificios (para elegir con cuál trabajar).
  const admin2 = await crearUsuario("Administradora de Dos Edificios", "admin.dos@example.com", "ADMINISTRACION");
  await db.membresia.create({ data: { userId: admin2, edificioId: EDIFICIO_RAMBLA, rol: "ADMINISTRACION" } });
  // Dueño del sistema (aprueba los edificios nuevos), Administración de Rambla.
  const dueno = await crearUsuario("Dueño del Sistema", "dueno@example.com", "ADMINISTRACION", EDIFICIO_RAMBLA);
  await db.user.update({ where: { id: dueno }, data: { duenoSistema: true } });
  // Rambla tiene piscina (informativa).
  await db.espacio.create({
    data: {
      edificioId: EDIFICIO_RAMBLA,
      nombre: "Piscina",
      tipo: "PISCINA",
      orden: 1,
      descripcion: "Abierta de diciembre a marzo, todos los días de 10 a 20 h.\n\nDucharse antes de entrar. Menores de 12 años, con un adulto.",
    },
  });
  // Vecina con apartamento en los dos edificios.
  const ana = { nombre: "Ana Dos Edificios", email: "ana.dos.edificios@example.com", telefono: "099000123" };
  const anaId = await crearUsuario(ana.nombre, ana.email, "UNIDAD");
  const enPrincipal = await db.unidad.create({ data: { edificioId: EDIFICIO, torreId: 5, numero: "601", etiqueta: "Apto 601" } });
  const enRambla = await db.unidad.create({ data: { edificioId: EDIFICIO_RAMBLA, torreId: torre.codigo, numero: "301", etiqueta: "Apto 301" } });
  for (const u of [enPrincipal, enRambla]) {
    await db.persona.create({ data: { unidadId: u.id, calidad: "PROPIETARIO", ...ana, userId: anaId, datosConfirmadosEn: new Date(), altaEn: ALTA } });
  }
  return `Edificio Rambla: 5 unidades; ${ana.email} tiene apartamento en los dos edificios y admin.dos@example.com administra los dos; dueno@example.com es el dueño del sistema.`;
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
