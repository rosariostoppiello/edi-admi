import "server-only";
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso } from "./sesion";
import { avisar } from "./mail";
import { altaInquilino, cambiarPropietario } from "./datos";
import { enviarInvitacion, tieneContrasena } from "./invitaciones";
import { whatsappAdministracion } from "./solicitudes";
import { edificiosActivos, equipoDelEdificio, SELECCION_CODIGO, unidadPorCodigo } from "./edificios";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { codigoBase } from "@/dominio/codigos";
import { datosPersonaSchema, NOMBRE_CALIDAD, esDueno, nombreCompleto } from "@/dominio/personas";

/**
 * Pedidos de acceso (decisión 84). Quien no tiene usuario lo pide desde el login; la
 * Administración comprueba que es de esa unidad y lo aprueba (carga a la persona y le
 * llega la invitación para crear su contraseña) o lo rechaza.
 */

const urlBase = () => process.env.BETTER_AUTH_URL ?? "";
/** Tope de pedidos nuevos por hora (frena el spam: el formulario es público). */
const MAX_POR_HORA = 30;

const RESPUESTA =
  "Recibimos tu pedido. La Administración va a comprobar que sos de esa unidad y, si corresponde, te llega un mail para crear tu contraseña.";
const PIDE_CODIGO = "Te mandamos un código de 6 números a tu mail. Escribilo acá para confirmar que el mail es tuyo.";
/** Minutos que vale el código y cuántas veces se puede errar. */
const VENCE_MINUTOS = 30;
const MAX_INTENTOS = 5;

const hashCodigo = (pedidoId: string, codigo: string) => createHash("sha256").update(`${pedidoId}:${codigo}`).digest("hex");

/** Resultado del primer paso: si sale bien, la pantalla pide el código (con este id). */
export type ResultadoPedido = Resultado & { pedidoId?: string };

const pedidoSchema = datosPersonaSchema.extend({
  codigo: z
    .string({ error: "Escribí el código de tu unidad (ej. 2-201)." })
    .trim()
    .min(1, "Escribí el código de tu unidad (ej. 2-201).")
    .max(20, "Revisá el código de la unidad."),
  calidad: z.enum(["PROPIETARIO", "PROMITENTE", "INQUILINO"], { error: "Elegí si sos propietario, promitente comprador o inquilino." }),
  mensaje: z
    .string()
    .optional()
    .transform((s) => s?.trim() ?? "")
    .pipe(z.string().max(500, "Es demasiado largo (máximo 500 caracteres).")),
  acepto: z.literal("si", { error: "Necesitamos tu permiso para usar estos datos." }),
  // Campo trampa: invisible para las personas; si viene con algo, es un robot.
  sitio: z.string().optional(),
  /** Solo si hay más de un edificio: lo elige la persona. */
  edificioId: z.string().optional(),
});

/**
 * Público (sin sesión), primer paso: guarda el pedido sin verificar y manda un código al
 * mail. Si el pedido es válido siempre responde igual: no revela quién tiene usuario.
 */
export async function pedirAcceso(input: unknown): Promise<ResultadoPedido> {
  const p = pedidoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;
  // A un robot o a un pedido repetido se le muestra la misma pantalla, con un id que no existe.
  const simulado = (): ResultadoPedido => ({ ...ok(PIDE_CODIGO), pedidoId: `x${randomInt(1e9)}` });
  if (d.sitio) return simulado();

  const edificios = await edificiosActivos();
  const edificio = edificios.length === 1 ? edificios[0] : edificios.find((e) => e.id === d.edificioId);
  if (!edificio) return error("Revisá los datos marcados.", { edificioId: "Elegí tu edificio." });
  const unidad = await unidadPorCodigo(edificio.id, d.codigo);
  if (!unidad) return error("Revisá los datos marcados.", { codigo: "No encontramos esa unidad. Escribí torre y número, ej. 2-201." });

  const email = d.email.toLowerCase();
  const repetido = await db.pedidoAcceso.findFirst({ where: { email, estado: "PENDIENTE" }, select: { id: true } });
  const recientes = await db.pedidoAcceso.count({ where: { creadoEn: { gte: new Date(Date.now() - 3_600_000) } } });
  if (repetido || recientes >= MAX_POR_HORA) return simulado();

  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const pedido = await db.pedidoAcceso.create({
    data: {
      nombre: d.nombre, apellido: d.apellido, email, telefono: d.telefono, codigo: d.codigo, unidadId: unidad.id, edificioId: edificio.id,
      calidad: d.calidad, mensaje: d.mensaje, estado: "SIN_VERIFICAR", codigoVence: new Date(Date.now() + VENCE_MINUTOS * 60_000),
    },
  });
  await db.pedidoAcceso.update({ where: { id: pedido.id }, data: { codigoHash: hashCodigo(pedido.id, codigo) } });
  await avisar({
    para: email,
    asunto: "Tu código de verificación",
    texto: [
      `Hola ${d.nombre}:`,
      "",
      `Tu código para confirmar el pedido de acceso es: ${codigo}`,
      `Vale por ${VENCE_MINUTOS} minutos.`,
      "",
      "Si no pediste acceso al sistema del edificio, ignorá este mail.",
      "",
      edificio.nombre,
    ].join("\n"),
  });
  return { ...ok(PIDE_CODIGO), pedidoId: pedido.id };
}

const verificacionSchema = z.object({
  pedidoId: z.string().min(1).max(40),
  codigoVerificacion: z
    .string({ error: "Escribí el código que te llegó al mail." })
    .transform((s) => s.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "El código tiene 6 números.")),
});

/** Público, segundo paso: con el código correcto el pedido pasa a la Administración. */
export async function verificarPedido(input: unknown): Promise<ResultadoPedido> {
  const p = verificacionSchema.safeParse(input);
  if (!p.success) return { ...erroresDeZod(p.error), pedidoId: (input as { pedidoId?: string })?.pedidoId };
  const { pedidoId, codigoVerificacion } = p.data;
  const incorrecto = (): ResultadoPedido => ({
    ...error("Revisá el código.", { codigoVerificacion: "Ese código no es correcto o ya venció. Revisá el mail o volvé a pedir acceso." }),
    pedidoId,
  });

  const pedido = await db.pedidoAcceso.findUnique({
    where: { id: pedidoId },
    include: { edificio: { select: { nombre: true } }, unidad: { select: SELECCION_CODIGO } },
  });
  if (!pedido || pedido.estado !== "SIN_VERIFICAR" || !pedido.codigoHash || !pedido.codigoVence) return incorrecto();
  if (pedido.codigoVence < new Date() || pedido.intentos >= MAX_INTENTOS) return incorrecto();
  if (pedido.codigoHash !== hashCodigo(pedido.id, codigoVerificacion)) {
    await db.pedidoAcceso.update({ where: { id: pedido.id }, data: { intentos: { increment: 1 } } });
    return incorrecto();
  }
  // Solo uno pendiente por mail: si ya había otro (verificado en paralelo), este se descarta.
  const repetido = await db.pedidoAcceso.findFirst({ where: { email: pedido.email, estado: "PENDIENTE" }, select: { id: true } });
  const c = await db.pedidoAcceso.updateMany({
    where: { id: pedido.id, estado: "SIN_VERIFICAR" },
    data: repetido ? { codigoHash: null, codigoVence: null } : { estado: "PENDIENTE", codigoHash: null, codigoVence: null },
  });
  if (c.count === 0 || repetido) return ok(RESPUESTA);

  const admins = await equipoDelEdificio(pedido.edificioId, ["ADMINISTRACION"]);
  const codigo = codigoBase(pedido.unidad.torre.numero, pedido.unidad.numero);
  await Promise.all(
    admins.map((a) =>
      avisar({
        para: a.email,
        asunto: `Pedido de acceso: unidad ${codigo}`,
        texto: [
          `${nombreCompleto(pedido)} pide acceso al sistema como ${NOMBRE_CALIDAD[pedido.calidad].toLowerCase()} de la unidad ${codigo} de ${pedido.edificio.nombre}.`,
          "Ya confirmó que el mail es suyo con un código.",
          "",
          "Comprobá que sea de esa unidad antes de aprobarlo.",
          `Para revisarlo: ${urlBase()}/datos/accesos#${pedido.id}`,
          "",
          pedido.edificio.nombre,
        ].join("\n"),
      }),
    ),
  );
  return ok(RESPUESTA);
}

/** Contacto de la Administración para la pantalla de login (datos de trabajo, no personales). */
export async function contactoAdministracion() {
  // Con varios edificios no se sabe de cuál es la persona: se ofrece solo el formulario.
  const edificios = await edificiosActivos();
  if (edificios.length !== 1) return { whatsapp: "", mail: "" };
  const edificioId = edificios[0].id;
  const ficha = await db.fichaContacto.findUnique({ where: { edificioId_clave: { edificioId, clave: "ADMINISTRACION" } } });
  const datos = (ficha?.datos ?? {}) as { mail?: string };
  return { whatsapp: await whatsappAdministracion(edificioId), mail: typeof datos.mail === "string" ? datos.mail : "" };
}

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

export async function pedidosPendientes(edificioId: string): Promise<number> {
  return db.pedidoAcceso.count({ where: { edificioId, estado: "PENDIENTE" } });
}

export async function listarPedidos() {
  const usuario = await exigirPermiso("usuarios.administrar");
  const filas = await db.pedidoAcceso.findMany({
    where: { edificioId: usuario.edificio.id, estado: { not: "SIN_VERIFICAR" } },
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    take: 100,
    include: {
      resueltoPor: { select: { name: true } },
      unidad: { select: { ...SELECCION_CODIGO, arrendada: true, personas: { where: { activa: true }, select: { nombre: true, apellido: true, email: true, calidad: true } } } },
    },
  });
  return filas.map((f) => ({
    ...f,
    nombre: nombreCompleto(f),
    unidadCodigo: codigoBase(f.unidad.torre.numero, f.unidad.numero),
    nombreCalidad: NOMBRE_CALIDAD[f.calidad],
    /** Qué pasa si se aprueba, para que la Administración decida sabiendo. */
    efecto: efectoDeAprobar(f.calidad, f.email, f.unidad.personas.map((p) => ({ ...p, nombre: nombreCompleto(p) }))),
  }));
}

type PersonaActiva = { nombre: string; email: string; calidad: "PROPIETARIO" | "PROMITENTE" | "INQUILINO" };

function efectoDeAprobar(calidad: PersonaActiva["calidad"], email: string, personas: PersonaActiva[]): string {
  const misma = personas.find((p) => p.email.toLowerCase() === email.toLowerCase());
  if (misma) return `Ya figura en la unidad como ${NOMBRE_CALIDAD[misma.calidad].toLowerCase()}: se le reenvía la invitación si todavía no creó su contraseña.`;
  if (calidad === "INQUILINO") {
    const inq = personas.find((p) => p.calidad === "INQUILINO");
    return inq ? `La unidad ya tiene inquilino (${inq.nombre}): primero hay que darlo de baja.` : "Se carga como inquilino de la unidad y le llega la invitación.";
  }
  const duenos = personas.filter((p) => esDueno(p.calidad));
  return duenos.length
    ? `Reemplaza a ${duenos.map((p) => p.nombre).join(" y ")} como responsable de la unidad (como en una venta). Le llega la invitación.`
    : "Se carga como responsable de la unidad y le llega la invitación.";
}

export async function aprobarPedido(id: string): Promise<Resultado> {
  const actor = await exigirPermiso("usuarios.administrar");
  const pedido = await db.pedidoAcceso.findFirst({
    where: { id, edificioId: actor.edificio.id },
    include: { unidad: { select: { personas: { where: { activa: true }, select: { id: true, email: true, userId: true } } } } },
  });
  if (!pedido) return error("No encontramos ese pedido.");
  if (pedido.estado !== "PENDIENTE") return error("Ese pedido ya se resolvió.");

  const datos = { nombre: pedido.nombre, apellido: pedido.apellido, telefono: pedido.telefono, email: pedido.email };
  const misma = pedido.unidad.personas.find((p) => p.email.toLowerCase() === pedido.email.toLowerCase());
  let r: Resultado;
  if (misma) {
    // Ya está cargado: solo hace falta que cree su contraseña.
    if (misma.userId && !(await tieneContrasena(misma.userId))) {
      await enviarInvitacion(misma.email);
      r = ok(`${nombreCompleto(pedido)} ya figuraba en la unidad: le reenviamos la invitación.`);
    } else {
      r = ok(`${nombreCompleto(pedido)} ya tiene usuario: puede entrar con su mail o usar "Me olvidé la contraseña".`);
    }
  } else if (pedido.calidad === "INQUILINO") {
    r = await altaInquilino(pedido.unidadId, datos);
  } else {
    r = await cambiarPropietario(pedido.unidadId, { ...datos, calidad: pedido.calidad });
  }
  if (!r.ok) return r;

  await db.$transaction(async (tx) => {
    await tx.pedidoAcceso.update({ where: { id }, data: { estado: "APROBADO", resueltoEn: new Date(), resueltoPorId: actor.userId } });
    await registrarAuditoria({ usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "acceso.aprobado", entidad: "pedido_acceso", entidadId: id, detalle: { email: pedido.email, calidad: pedido.calidad } }, tx);
  });
  return ok(`Aprobaste el pedido. ${r.mensaje}`);
}

const rechazoSchema = z.object({
  motivo: z
    .string()
    .optional()
    .transform((s) => s?.trim() ?? "")
    .pipe(z.string().max(500, "Es demasiado largo (máximo 500 caracteres).")),
});

export async function rechazarPedido(id: string, input: unknown): Promise<Resultado> {
  const actor = await exigirPermiso("usuarios.administrar");
  const p = rechazoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const pedido = await db.pedidoAcceso.findFirst({ where: { id, edificioId: actor.edificio.id }, select: { estado: true, email: true, nombre: true } });
  if (!pedido) return error("No encontramos ese pedido.");

  const r = await db.$transaction(async (tx) => {
    const c = await tx.pedidoAcceso.updateMany({
      where: { id, estado: "PENDIENTE" },
      data: { estado: "RECHAZADO", resueltoEn: new Date(), resueltoPorId: actor.userId, motivo: p.data.motivo || null },
    });
    if (c.count === 0) return false;
    await registrarAuditoria({ usuarioId: actor.userId, edificioId: actor.edificio.id, accion: "acceso.rechazado", entidad: "pedido_acceso", entidadId: id, detalle: { motivo: p.data.motivo } }, tx);
    return true;
  });
  if (!r) return error("Ese pedido ya se resolvió.");

  await avisar({
    para: pedido.email,
    asunto: "Tu pedido de acceso al sistema del edificio",
    texto: [
      `Hola ${pedido.nombre}:`,
      "",
      "No pudimos confirmar tu pedido de acceso al sistema.",
      p.data.motivo ? `Motivo: ${p.data.motivo}` : "",
      "",
      "Si creés que es un error, comunicate con la Administración.",
      "",
      actor.edificio.nombre,
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n"),
  });
  return ok("Rechazaste el pedido. Le avisamos por mail.");
}
