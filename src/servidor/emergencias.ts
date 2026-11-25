import "server-only";
import { z } from "zod";
import { db } from "./db";
import { registrarAuditoria } from "./auditoria";
import { exigirPermiso, type UsuarioActual } from "./sesion";
import { unidadActiva } from "./unidad-activa";
import { avisar, enviarMail } from "./mail";
import { destinatariosPorUnidad } from "./datos";
import { obtenerFicha } from "./telefonos";
import { error, erroresDeZod, ok, type Resultado } from "./resultado";
import { puede } from "@/dominio/permisos";
import { codigoBase } from "@/dominio/codigos";
import {
  CORTO_TIPO,
  NOMBRE_ESTADO,
  NOMBRE_TIPO,
  TIPOS_EMERGENCIA,
  minutosParaAvisar,
  primerTelefono,
  type TipoEmergencia,
} from "@/dominio/emergencias";
import { NOMBRE_COMPLEJO, NOMBRE_ROL } from "@/lib/edificio";

const LOTE = 10;
const urlBase = () => process.env.BETTER_AUTH_URL ?? "";

const textoLibre = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/[ \t]+/g, " ") ?? "")
    .pipe(
      z.string().max(max, `Es demasiado largo (máximo ${max} caracteres).`),
    );

// ---------------------------------------------------------------------------
// Teléfonos para llamar ya (Portería y Administración)
// ---------------------------------------------------------------------------

export async function telefonosDeAyuda() {
  const [porteria, admin] = [
    await obtenerFicha("PORTERIA"),
    await obtenerFicha("ADMINISTRACION"),
  ];
  return {
    porteria: primerTelefono(porteria?.telefono),
    administracion: primerTelefono(admin?.celulares),
  };
}

// ---------------------------------------------------------------------------
// Avisar
// ---------------------------------------------------------------------------

const avisoSchema = z.object({
  tipo: z.enum(TIPOS_EMERGENCIA, { error: "Elegí qué está pasando." }),
  lugar: textoLibre(120),
  detalle: textoLibre(1000),
  // Segunda confirmación (mantener apretado el botón): sin esto no se manda.
  confirmado: z.literal("si", {
    error: "Confirmá que es una emergencia real.",
  }),
});

export async function avisarEmergencia(input: unknown): Promise<Resultado> {
  const usuario = await exigirPermiso("emergencia.avisar");
  const p = avisoSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);
  const d = p.data;

  const ultimo = await db.emergencia.findFirst({
    where: { autorId: usuario.userId },
    orderBy: { creadaEn: "desc" },
    select: { creadaEn: true },
  });
  const espera = minutosParaAvisar(ultimo?.creadaEn ?? null);
  if (espera > 0) {
    return error(
      `Ya mandaste un aviso hace un momento: Portería ya lo tiene. Si necesitás, llamá directamente. Podés mandar otro en ${espera} ${espera === 1 ? "minuto" : "minutos"}.`,
    );
  }

  const unidad =
    usuario.rol === "UNIDAD" || usuario.unidadesDetalle.length
      ? await unidadActiva(usuario)
      : null;
  const codigo = unidad ? codigoBase(unidad.torre, unidad.numero) : null;

  const e = await db.$transaction(async (tx) => {
    const creada = await tx.emergencia.create({
      data: {
        tipo: d.tipo,
        lugar: d.lugar,
        detalle: d.detalle,
        autorId: usuario.userId,
        unidadId: unidad?.unidadId ?? null,
      },
    });
    await registrarAuditoria(
      {
        usuarioId: usuario.userId,
        accion: "emergencia.aviso",
        entidad: "emergencia",
        entidadId: creada.id,
        detalle: { tipo: d.tipo, lugar: d.lugar },
      },
      tx,
    );
    return creada;
  });

  // Mail inmediato a quienes pueden actuar (fuera de la transacción: el aviso ya quedó).
  const equipo = await db.user.findMany({
    where: {
      rol: { in: ["PORTERIA", "ADMINISTRACION", "COMISION"] },
      activo: true,
    },
    select: { email: true },
  });
  const quien = codigo
    ? `${usuario.nombre} (unidad ${codigo})`
    : `${usuario.nombre} (${NOMBRE_ROL[usuario.rol]})`;
  const texto = [
    `EMERGENCIA: ${NOMBRE_TIPO[d.tipo]}`,
    "",
    `Avisó: ${quien}`,
    d.lugar ? `Dónde: ${d.lugar}` : "",
    d.detalle ? `Detalle: ${d.detalle}` : "",
    "",
    `Para verla y avisar a todas las unidades: ${urlBase()}/emergencia/avisos/${e.id}`,
    "",
    NOMBRE_COMPLEJO,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  await Promise.all(
    equipo.map((u) =>
      avisar({
        para: u.email,
        asunto: `EMERGENCIA: ${CORTO_TIPO[d.tipo]}${d.lugar ? ` en ${d.lugar}` : ""}`,
        texto,
      }),
    ),
  );

  return ok(
    "Avisaste a Portería y a la Administración. Si todavía no llamaste al 911, hacelo ahora.",
  );
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

const seleccion = {
  id: true,
  tipo: true,
  lugar: true,
  detalle: true,
  estado: true,
  creadaEn: true,
  difundidaEn: true,
  mensajeGeneral: true,
  cerradaEn: true,
  nota: true,
  autor: { select: { name: true, rol: true } },
  unidad: { select: { torreId: true, numero: true } },
  difundidaPor: { select: { name: true } },
  cerradaPor: { select: { name: true } },
} as const;

type Fila = Awaited<ReturnType<typeof leer>>[number];
const leer = (where: object, take = 50) =>
  db.emergencia.findMany({
    where,
    select: seleccion,
    orderBy: { creadaEn: "desc" },
    take,
  });

function mostrar(f: Fila) {
  return {
    ...f,
    codigo: f.unidad ? codigoBase(f.unidad.torreId, f.unidad.numero) : null,
    quien: f.autor.name,
    rolAutor: NOMBRE_ROL[f.autor.rol],
    nombreTipo: NOMBRE_TIPO[f.tipo as TipoEmergencia],
    corto: CORTO_TIPO[f.tipo as TipoEmergencia],
    nombreEstado: NOMBRE_ESTADO[f.estado],
  };
}
export type EmergenciaVista = ReturnType<typeof mostrar>;

/**
 * Alertas para la franja roja de la cabecera. Portería, Administración y Comisión
 * ven todas las activas; las unidades ven solo las que se avisaron a todos, y sin
 * saber quién avisó (Ley 18.331).
 */
export async function alertasParaCabecera(usuario: UsuarioActual) {
  if (puede(usuario, "emergencia.ver")) {
    return (await leer({ estado: "ACTIVA" }, 10)).map((f) => ({
      id: f.id,
      texto: `${CORTO_TIPO[f.tipo as TipoEmergencia]}${f.lugar ? ` en ${f.lugar}` : ""}`,
      equipo: true,
    }));
  }
  const filas = await db.emergencia.findMany({
    where: { estado: "ACTIVA", difundidaEn: { not: null } },
    select: { id: true, mensajeGeneral: true },
    orderBy: { creadaEn: "desc" },
    take: 3,
  });
  return filas.map((f) => ({
    id: f.id,
    texto: f.mensajeGeneral ?? "Aviso de emergencia en el edificio.",
    equipo: false,
  }));
}

export async function listarEmergencias() {
  await exigirPermiso("emergencia.ver");
  return (await leer({})).map(mostrar);
}

export async function obtenerEmergencia(id: string) {
  await exigirPermiso("emergencia.ver");
  const f = await db.emergencia.findUnique({
    where: { id },
    select: seleccion,
  });
  if (!f) return null;
  const grupos = await db.envioMail.groupBy({
    by: ["estado"],
    where: { tipo: { in: ["emergencia", "emergencia-fin"] }, refId: id },
    _count: true,
  });
  const envio = Object.fromEntries(
    grupos.map((g) => [g.estado, g._count]),
  ) as Partial<Record<"PENDIENTE" | "ENVIADO" | "ERROR", number>>;
  return { ...mostrar(f), envio };
}

// ---------------------------------------------------------------------------
// Avisar a todas las unidades y cerrar
// ---------------------------------------------------------------------------

const difusionSchema = z.object({
  mensaje: textoLibre(600).pipe(
    z.string().min(1, "Escribí qué tienen que saber los vecinos."),
  ),
  confirmado: z.literal("si", {
    error: "Confirmá que comprobaste la emergencia.",
  }),
});

export async function avisarATodos(
  id: string,
  input: unknown,
): Promise<Resultado> {
  const actor = await exigirPermiso("emergencia.gestionar");
  const p = difusionSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);

  const r = await db.$transaction(
    async (tx): Promise<{ mails: number } | Resultado> => {
      // Solo una vez y solo si sigue activa (dos porteros a la vez no duplican el envío).
      const marcada = await tx.emergencia.updateMany({
        where: { id, estado: "ACTIVA", difundidaEn: null },
        data: {
          difundidaEn: new Date(),
          difundidaPorId: actor.userId,
          mensajeGeneral: p.data.mensaje,
        },
      });
      if (marcada.count === 0)
        return error(
          "Ya se avisó a todas las unidades, o la emergencia ya está cerrada.",
        );
      const emails = [
        ...new Set(
          (await destinatariosPorUnidad()).flatMap((u) =>
            u.destinatarios.map((d) => d.email.toLowerCase()),
          ),
        ),
      ];
      await tx.envioMail.createMany({
        data: emails.map((e) => ({
          tipo: "emergencia",
          refId: id,
          destinatario: e,
          asunto: "Aviso de emergencia en el edificio",
        })),
      });
      await registrarAuditoria(
        {
          usuarioId: actor.userId,
          accion: "emergencia.difundida",
          entidad: "emergencia",
          entidadId: id,
          detalle: { mails: emails.length },
        },
        tx,
      );
      return { mails: emails.length };
    },
  );
  if ("ok" in r) return r;

  const e = await procesarEnvios(id, "emergencia", p.data.mensaje);
  return ok(
    `Avisaste a todas las unidades: se mandaron ${e.enviados} mails${e.errores ? ` (${e.errores} con error)` : ""}. Todos ven el aviso al entrar al sistema.`,
  );
}

const cierreSchema = z.object({
  estado: z.enum(["ATENDIDA", "FALSA_ALARMA"], {
    error: "Elegí cómo terminó.",
  }),
  nota: textoLibre(600),
});

export async function cerrarEmergencia(
  id: string,
  input: unknown,
): Promise<Resultado> {
  const actor = await exigirPermiso("emergencia.gestionar");
  const p = cierreSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);

  const r = await db.$transaction(
    async (tx): Promise<{ difundida: boolean; mails: number } | Resultado> => {
      const actual = await tx.emergencia.findUnique({
        where: { id },
        select: { estado: true, difundidaEn: true },
      });
      if (!actual) return error("No encontramos esa emergencia.");
      const cerrada = await tx.emergencia.updateMany({
        where: { id, estado: "ACTIVA" },
        data: {
          estado: p.data.estado,
          cerradaEn: new Date(),
          cerradaPorId: actor.userId,
          nota: p.data.nota || null,
        },
      });
      if (cerrada.count === 0)
        return error("Esa emergencia ya estaba cerrada.");
      let mails = 0;
      // Si se había avisado a todos, también se les avisa que terminó.
      if (actual.difundidaEn) {
        const emails = [
          ...new Set(
            (await destinatariosPorUnidad()).flatMap((u) =>
              u.destinatarios.map((d) => d.email.toLowerCase()),
            ),
          ),
        ];
        await tx.envioMail.createMany({
          data: emails.map((e) => ({
            tipo: "emergencia-fin",
            refId: id,
            destinatario: e,
            asunto: "Terminó la emergencia en el edificio",
          })),
        });
        mails = emails.length;
      }
      await registrarAuditoria(
        {
          usuarioId: actor.userId,
          accion: "emergencia.cerrada",
          entidad: "emergencia",
          entidadId: id,
          detalle: { estado: p.data.estado, mails },
        },
        tx,
      );
      return { difundida: !!actual.difundidaEn, mails };
    },
  );
  if ("ok" in r) return r;

  const frase =
    p.data.estado === "ATENDIDA"
      ? "Marcaste la emergencia como atendida"
      : "Marcaste el aviso como falsa alarma";
  if (!r.difundida) return ok(`${frase}.`);
  const texto =
    p.data.estado === "ATENDIDA"
      ? `La emergencia que avisamos ya fue atendida.${p.data.nota ? ` ${p.data.nota}` : ""}`
      : `El aviso de emergencia fue una falsa alarma: no hay ningún peligro.${p.data.nota ? ` ${p.data.nota}` : ""}`;
  const e = await procesarEnvios(id, "emergencia-fin", texto);
  return ok(
    `${frase} y les avisaste a todas las unidades (${e.enviados} mails${e.errores ? `, ${e.errores} con error` : ""}).`,
  );
}

export async function reintentarEnvios(id: string): Promise<Resultado> {
  const actor = await exigirPermiso("emergencia.gestionar");
  const f = await db.emergencia.findUnique({
    where: { id },
    select: { mensajeGeneral: true, estado: true, nota: true },
  });
  if (!f) return error("No encontramos esa emergencia.");
  const a = await procesarEnvios(id, "emergencia", f.mensajeGeneral ?? "");
  const fin =
    f.estado === "ACTIVA"
      ? { enviados: 0, errores: 0 }
      : await procesarEnvios(
          id,
          "emergencia-fin",
          f.estado === "ATENDIDA"
            ? `La emergencia que avisamos ya fue atendida.${f.nota ? ` ${f.nota}` : ""}`
            : `El aviso de emergencia fue una falsa alarma: no hay ningún peligro.${f.nota ? ` ${f.nota}` : ""}`,
        );
  const r = {
    enviados: a.enviados + fin.enviados,
    errores: a.errores + fin.errores,
  };
  await registrarAuditoria({
    usuarioId: actor.userId,
    accion: "emergencia.reenvio",
    entidad: "emergencia",
    entidadId: id,
    detalle: r,
  });
  if (r.enviados + r.errores === 0) return ok("No había mails pendientes.");
  return r.errores
    ? error(`Se mandaron ${r.enviados}; ${r.errores} siguen con error.`)
    : ok(`Se mandaron ${r.enviados} mails.`);
}

/** Manda los mails pendientes de una emergencia, de a 10. */
async function procesarEnvios(
  id: string,
  tipo: "emergencia" | "emergencia-fin",
  mensaje: string,
) {
  const pendientes = await db.envioMail.findMany({
    where: { tipo, refId: id, estado: { in: ["PENDIENTE", "ERROR"] } },
  });
  const texto = [
    mensaje,
    "",
    `Más información en el sistema: ${urlBase()}/inicio`,
    "",
    NOMBRE_COMPLEJO,
  ].join("\n");
  let enviados = 0;
  let errores = 0;
  for (let i = 0; i < pendientes.length; i += LOTE) {
    await Promise.all(
      pendientes.slice(i, i + LOTE).map(async (envio) => {
        try {
          await enviarMail({
            para: envio.destinatario,
            asunto: envio.asunto,
            texto,
          });
          await db.envioMail.update({
            where: { id: envio.id },
            data: {
              estado: "ENVIADO",
              enviadoEn: new Date(),
              error: null,
              intentos: { increment: 1 },
            },
          });
          enviados++;
        } catch (e) {
          await db.envioMail.update({
            where: { id: envio.id },
            data: {
              estado: "ERROR",
              error: String((e as Error).message).slice(0, 300),
              intentos: { increment: 1 },
            },
          });
          errores++;
        }
      }),
    );
  }
  return { enviados, errores };
}
