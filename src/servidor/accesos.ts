import "server-only";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso } from "./sesion";
import { avisar } from "./mail";
import { altaInquilino, cambiarPropietario } from "./datos";
import { enviarInvitacion, tieneContrasena } from "./invitaciones";
import { whatsappAdministracion } from "./solicitudes";
import { edificiosActivos, SELECCION_CODIGO, unidadPorCodigo } from "./edificios";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { codigoBase } from "@/dominio/codigos";
import { datosPersonaSchema, NOMBRE_CALIDAD, esDueno } from "@/dominio/personas";

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
  /** Solo si hay más de un edificio: lo elige la persona. */
  edificioId: z.string().optional(),
});

/** Público (sin sesión). Siempre responde lo mismo si el pedido es válido: no revela quién tiene usuario. */
export async function pedirAcceso(input: unknown): Promise<Resultado> {
  const p = pedidoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;
  if (d.sitio) return ok(RESPUESTA);

  const edificios = await edificiosActivos();
  const edificio = edificios.length === 1 ? edificios[0] : edificios.find((e) => e.id === d.edificioId);
  if (!edificio) return error("Revisá los datos marcados.", { edificioId: "Elegí tu edificio." });
  const unidad = await unidadPorCodigo(edificio.id, d.codigo);
  if (!unidad) return error("Revisá los datos marcados.", { codigo: "No encontramos esa unidad. Escribí torre y número, ej. 2-201." });

  const email = d.email.toLowerCase();
  const repetido = await db.pedidoAcceso.findFirst({ where: { email, estado: "PENDIENTE" }, select: { id: true } });
  const recientes = await db.pedidoAcceso.count({ where: { creadoEn: { gte: new Date(Date.now() - 3_600_000) } } });
  if (repetido || recientes >= MAX_POR_HORA) return ok(RESPUESTA);

  const pedido = await db.pedidoAcceso.create({
    data: { nombre: d.nombre, email, telefono: d.telefono, codigo: d.codigo, unidadId: unidad.id, edificioId: edificio.id, calidad: d.calidad, mensaje: d.mensaje },
  });

  const admins = await db.user.findMany({ where: { rol: "ADMINISTRACION", activo: true }, select: { email: true } });
  const codigo = codigoBase(unidad.torre.numero, unidad.numero);
  await Promise.all(
    admins.map((a) =>
      avisar({
        para: a.email,
        asunto: `Pedido de acceso: unidad ${codigo}`,
        texto: [
          `${d.nombre} pide acceso al sistema como ${NOMBRE_CALIDAD[d.calidad].toLowerCase()} de la unidad ${codigo} de ${edificio.nombre}.`,
          "",
          "Comprobá que sea de esa unidad antes de aprobarlo.",
          `Para revisarlo: ${urlBase()}/datos/accesos#${pedido.id}`,
          "",
          edificio.nombre,
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
    where: { edificioId: usuario.edificio.id },
    orderBy: [{ estado: "asc" }, { creadoEn: "desc" }],
    take: 100,
    include: {
      resueltoPor: { select: { name: true } },
      unidad: { select: { ...SELECCION_CODIGO, arrendada: true, personas: { where: { activa: true }, select: { nombre: true, email: true, calidad: true } } } },
    },
  });
  return filas.map((f) => ({
    ...f,
    unidadCodigo: codigoBase(f.unidad.torre.numero, f.unidad.numero),
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
  const pedido = await db.pedidoAcceso.findFirst({
    where: { id, edificioId: actor.edificio.id },
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
