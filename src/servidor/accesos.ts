import "server-only";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso } from "./sesion";
import { avisar } from "./mail";
import { altaInquilino, cambiarPropietario } from "./datos";
import { enviarInvitacion, tieneContrasena } from "./invitaciones";
import { whatsappAdministracion } from "./solicitudes";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { codigoBase } from "@/dominio/codigos";
import { datosPersonaSchema, NOMBRE_CALIDAD, esDueno } from "@/dominio/personas";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";

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
});

/** "2-201", "2-201-A" o "2 201" → unidad activa. */
async function unidadPorCodigo(texto: string) {
  const m = /^(\d{1,3})[\s-]+([0-9A-Za-z]{1,6})(?:[\s-]*[APIapi])?$/.exec(texto.trim());
  if (!m) return null;
  return db.unidad.findFirst({ where: { torreId: Number(m[1]), numero: m[2].toUpperCase(), activa: true }, select: { id: true, torreId: true, numero: true } });
}

/** Público (sin sesión). Siempre responde lo mismo si el pedido es válido: no revela quién tiene usuario. */
export async function pedirAcceso(input: unknown): Promise<Resultado> {
  const p = pedidoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;
  if (d.sitio) return ok(RESPUESTA);

  const unidad = await unidadPorCodigo(d.codigo);
  if (!unidad) return error("Revisá los datos marcados.", { codigo: "No encontramos esa unidad. Escribí torre y número, ej. 2-201." });

  const email = d.email.toLowerCase();
  const repetido = await db.pedidoAcceso.findFirst({ where: { email, estado: "PENDIENTE" }, select: { id: true } });
  const recientes = await db.pedidoAcceso.count({ where: { creadoEn: { gte: new Date(Date.now() - 3_600_000) } } });
  if (repetido || recientes >= MAX_POR_HORA) return ok(RESPUESTA);

  const pedido = await db.pedidoAcceso.create({
    data: { nombre: d.nombre, email, telefono: d.telefono, codigo: d.codigo, unidadId: unidad.id, calidad: d.calidad, mensaje: d.mensaje },
  });

  const admins = await db.user.findMany({ where: { rol: "ADMINISTRACION", activo: true }, select: { email: true } });
  const codigo = codigoBase(unidad.torreId, unidad.numero);
  await Promise.all(
    admins.map((a) =>
      avisar({
        para: a.email,
        asunto: `Pedido de acceso: unidad ${codigo}`,
        texto: [
          `${d.nombre} pide acceso al sistema como ${NOMBRE_CALIDAD[d.calidad].toLowerCase()} de la unidad ${codigo}.`,
          "",
          "Comprobá que sea de esa unidad antes de aprobarlo.",
          `Para revisarlo: ${urlBase()}/datos/accesos#${pedido.id}`,
          "",
          NOMBRE_COMPLEJO,
        ].join("\n"),
      }),
    ),
  );
  return ok(RESPUESTA);
}

/** Contacto de la Administración para la pantalla de login (datos de trabajo, no personales). */
export async function contactoAdministracion() {
  const ficha = await db.fichaContacto.findUnique({ where: { clave: "ADMINISTRACION" } });
  const datos = (ficha?.datos ?? {}) as { mail?: string };
  return { whatsapp: await whatsappAdministracion(), mail: typeof datos.mail === "string" ? datos.mail : "" };
}

// ---------------------------------------------------------------------------
// Administración
// ---------------------------------------------------------------------------

export async function pedidosPendientes(): Promise<number> {
  return db.pedidoAcceso.count({ where: { estado: "PENDIENTE" } });
}

export async function listarPedidos() {
  await exigirPermiso("usuarios.administrar");
  const filas = await db.pedidoAcceso.findMany({
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    take: 100,
    include: {
      resueltoPor: { select: { name: true } },
      unidad: { select: { torreId: true, numero: true, arrendada: true, personas: { where: { activa: true }, select: { nombre: true, email: true, calidad: true } } } },
    },
  });
  return filas.map((f) => ({
    ...f,
    unidadCodigo: codigoBase(f.unidad.torreId, f.unidad.numero),
    nombreCalidad: NOMBRE_CALIDAD[f.calidad],
    /** Qué pasa si se aprueba, para que la Administración decida sabiendo. */
    efecto: efectoDeAprobar(f.calidad, f.email, f.unidad.personas),
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
  const pedido = await db.pedidoAcceso.findUnique({
    where: { id },
    include: { unidad: { select: { personas: { where: { activa: true }, select: { id: true, email: true, userId: true } } } } },
  });
  if (!pedido) return error("No encontramos ese pedido.");
  if (pedido.estado !== "PENDIENTE") return error("Ese pedido ya se resolvió.");

  const datos = { nombre: pedido.nombre, telefono: pedido.telefono, email: pedido.email };
  const misma = pedido.unidad.personas.find((p) => p.email.toLowerCase() === pedido.email.toLowerCase());
  let r: Resultado;
  if (misma) {
    // Ya está cargado: solo hace falta que cree su contraseña.
    if (misma.userId && !(await tieneContrasena(misma.userId))) {
      await enviarInvitacion(misma.email);
      r = ok(`${pedido.nombre} ya figuraba en la unidad: le reenviamos la invitación.`);
    } else {
      r = ok(`${pedido.nombre} ya tiene usuario: puede entrar con su mail o usar "Me olvidé la contraseña".`);
    }
  } else if (pedido.calidad === "INQUILINO") {
    r = await altaInquilino(pedido.unidadId, datos);
  } else {
    r = await cambiarPropietario(pedido.unidadId, { ...datos, calidad: pedido.calidad });
  }
  if (!r.ok) return r;

  await db.$transaction(async (tx) => {
    await tx.pedidoAcceso.update({ where: { id }, data: { estado: "APROBADO", resueltoEn: new Date(), resueltoPorId: actor.userId } });
    await registrarAuditoria({ usuarioId: actor.userId, accion: "acceso.aprobado", entidad: "pedido_acceso", entidadId: id, detalle: { email: pedido.email, calidad: pedido.calidad } }, tx);
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
  const pedido = await db.pedidoAcceso.findUnique({ where: { id }, select: { estado: true, email: true, nombre: true } });
  if (!pedido) return error("No encontramos ese pedido.");

  const r = await db.$transaction(async (tx) => {
    const c = await tx.pedidoAcceso.updateMany({
      where: { id, estado: "PENDIENTE" },
      data: { estado: "RECHAZADO", resueltoEn: new Date(), resueltoPorId: actor.userId, motivo: p.data.motivo || null },
    });
    if (c.count === 0) return false;
    await registrarAuditoria({ usuarioId: actor.userId, accion: "acceso.rechazado", entidad: "pedido_acceso", entidadId: id, detalle: { motivo: p.data.motivo } }, tx);
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
      NOMBRE_COMPLEJO,
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n"),
  });
  return ok("Rechazaste el pedido. Le avisamos por mail.");
}
