import "server-only";
import { z } from "zod";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";
import { destinatariosPorUnidad } from "../datos";
import { enviarMail } from "../mail";
import { exigirPermiso } from "../sesion";
import { error, erroresDeZod, ok, type Resultado } from "../resultado";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";
import { formatearPesos, type Centesimos } from "@/dominio/dinero";
import { formatearFecha, nombreMes, periodoEnFrase, vencimiento } from "@/dominio/liquidacion/periodo";
import { textoSchema } from "@/dominio/liquidacion/esquemas";
import { armarLiquidacion, calcularBorrador, configuracion } from "./armado";
import { generarPdf, nombreArchivoPdf } from "./pdf";

/** Cuántos mails se mandan a la vez. */
const LOTE = 10;

export interface Destino {
  email: string;
  nombre: string | null;
  lineas: { codigo: string; saldoAPagar: number }[];
}

/** A quién le llega la liquidación: cada mail una sola vez, con sus líneas. */
async function destinos(lineas: { unidadId: string; sufijo: string; codigo: string; saldoAPagar: number }[]): Promise<Destino[]> {
  const porLinea = new Map(lineas.map((l) => [`${l.unidadId}|${l.sufijo}`, l]));
  const porMail = new Map<string, Destino>();
  for (const u of await destinatariosPorUnidad()) {
    for (const d of u.destinatarios) {
      const l = porLinea.get(`${u.unidadId}|${d.sufijo}`);
      if (!l) continue;
      const destino = porMail.get(d.email) ?? { email: d.email, nombre: d.nombre, lineas: [] };
      destino.lineas.push({ codigo: l.codigo, saldoAPagar: l.saldoAPagar });
      porMail.set(d.email, destino);
    }
  }
  return [...porMail.values()];
}

/** Cuántos mails saldrían al publicar (para la confirmación). */
export async function contarDestinatarios(liquidacionId: string) {
  await exigirPermiso("liquidacion.publicar");
  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId } });
  if (!liq) return { mails: 0, lineasSinMail: [] as string[] };
  const { lineas } = await calcularBorrador(liq);
  const d = await destinos(lineas);
  const conMail = new Set(d.flatMap((x) => x.lineas.map((l) => l.codigo)));
  return { mails: d.length, lineasSinMail: lineas.filter((l) => !conMail.has(l.codigo)).map((l) => l.codigo) };
}

function textoMail(periodo: string, dia: number, destino: Destino, rectificada: boolean) {
  const base = process.env.BETTER_AUTH_URL ?? "";
  const lineas = destino.lineas
    .map((l) =>
      l.saldoAPagar < 0
        ? `${l.codigo}: saldo a favor de ${formatearPesos((-l.saldoAPagar) as Centesimos)}`
        : `${l.codigo}: total a pagar ${formatearPesos(l.saldoAPagar as Centesimos)}`,
    )
    .join("\n");
  return [
    `Hola${destino.nombre ? ` ${destino.nombre}` : ""}:`,
    "",
    rectificada
      ? `Te mandamos la liquidación de gastos comunes de ${nombreMes(periodo)} corregida. Reemplaza a la que te enviamos antes.`
      : `Ya está la liquidación de gastos comunes de ${nombreMes(periodo)}.`,
    "",
    lineas,
    "",
    `Vence el ${formatearFecha(vencimiento(periodo, dia))}. Al pagar, indicá el número de unidad completo en la referencia.`,
    "",
    "Te adjuntamos el PDF con la liquidación completa.",
    base ? `También la podés ver en el sistema: ${base}/liquidaciones/${periodo}` : "",
    "",
    "Administración",
  ].join("\n");
}

/**
 * Publica: guarda la foto de las líneas, genera el PDF y deja los mails en la
 * bandeja de salida, todo en una transacción. Después manda los mails.
 * Es irreversible: solo se puede anular (con motivo y auditoría).
 */
export async function publicarLiquidacion(liquidacionId: string): Promise<Resultado & { periodo?: string }> {
  const actor = await exigirPermiso("liquidacion.publicar");
  const cfg = await configuracion();

  const r = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "liquidacion" WHERE id = ${liquidacionId} FOR UPDATE`;
      const liq = await tx.liquidacion.findUnique({ where: { id: liquidacionId } });
      if (!liq) return error("No encontramos esa liquidación.");
      if (liq.estado !== "BORRADOR") return error("Esta liquidación ya está publicada.");

      const calculo = await calcularBorrador(liq, tx);
      if (calculo.sinUbicar.length) {
        return error("Hay saldos o pagos de unidades que ya no están activas. Revisalos antes de publicar.");
      }
      if (calculo.lineas.length === 0) return error("No hay unidades para liquidar.");

      await tx.lineaLiquidacion.createMany({
        data: calculo.lineas.map((l) => ({ liquidacionId, ...l })),
      });
      await tx.liquidacion.update({
        where: { id: liquidacionId },
        data: { estado: "PUBLICADA", publicadaEn: new Date(), publicadaPorId: actor.userId },
      });

      const armada = (await armarLiquidacion(liquidacionId, tx))!;
      const pdf = await generarPdf(armada, NOMBRE_COMPLEJO, cfg.direccion);
      const archivo = await tx.archivo.create({
        data: { nombre: nombreArchivoPdf(liq.periodo, "PUBLICADA"), tipo: "application/pdf", tamano: pdf.length, datos: new Uint8Array(pdf) },
      });
      await tx.liquidacion.update({ where: { id: liquidacionId }, data: { pdfId: archivo.id } });

      const lista = await destinos(calculo.lineas);
      const asunto = `${liq.rectificaId ? "Liquidación rectificada" : "Liquidación"} de gastos comunes de ${nombreMes(liq.periodo)} ${liq.periodo.slice(0, 4)}`;
      await tx.envioMail.createMany({
        data: lista.map((d) => ({ tipo: "liquidacion", refId: liquidacionId, destinatario: d.email, asunto })),
      });

      await registrarAuditoria(
        {
          usuarioId: actor.userId,
          accion: "liquidacion.publicada",
          entidad: "liquidacion",
          entidadId: liquidacionId,
          detalle: {
            periodo: liq.periodo,
            lineas: calculo.lineas.length,
            totalAPagar: calculo.totales.saldoAPagar,
            mails: lista.length,
            rectificaA: liq.rectificaId,
          },
        },
        tx,
      );
      return { ...ok(`Publicaste la liquidación de ${periodoEnFrase(liq.periodo)}.`), periodo: liq.periodo };
    },
    { timeout: 60_000 },
  );

  if (r.ok) await procesarEnvios(liquidacionId);
  return r;
}

/** Manda los mails pendientes (o con error, si `reintentar`) de una liquidación, por lotes. */
export async function procesarEnvios(liquidacionId: string, reintentar = false) {
  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId }, include: { pdf: true } });
  if (!liq || liq.estado !== "PUBLICADA" || !liq.pdf) return { enviados: 0, errores: 0 };
  const pendientes = await db.envioMail.findMany({
    where: { tipo: "liquidacion", refId: liquidacionId, estado: reintentar ? { in: ["PENDIENTE", "ERROR"] } : "PENDIENTE" },
  });
  const lineas = await db.lineaLiquidacion.findMany({ where: { liquidacionId } });
  const porMail = new Map((await destinos(lineas)).map((d) => [d.email, d]));
  const adjunto = { nombre: liq.pdf.nombre, tipo: liq.pdf.tipo, contenido: Buffer.from(liq.pdf.datos) };

  let enviados = 0;
  let errores = 0;
  for (let i = 0; i < pendientes.length; i += LOTE) {
    await Promise.all(
      pendientes.slice(i, i + LOTE).map(async (envio) => {
        const destino = porMail.get(envio.destinatario) ?? { email: envio.destinatario, nombre: null, lineas: [] };
        try {
          await enviarMail({
            para: envio.destinatario,
            asunto: envio.asunto,
            texto: textoMail(liq.periodo, liq.diaVencimiento, destino, Boolean(liq.rectificaId)),
            adjuntos: [adjunto],
          });
          await db.envioMail.update({
            where: { id: envio.id },
            data: { estado: "ENVIADO", enviadoEn: new Date(), error: null, intentos: { increment: 1 } },
          });
          enviados++;
        } catch (e) {
          await db.envioMail.update({
            where: { id: envio.id },
            data: { estado: "ERROR", error: String((e as Error).message).slice(0, 300), intentos: { increment: 1 } },
          });
          errores++;
        }
      }),
    );
  }
  return { enviados, errores };
}

export async function reintentarEnvios(liquidacionId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.publicar");
  const r = await procesarEnvios(liquidacionId, true);
  await registrarAuditoria({ usuarioId: actor.userId, accion: "liquidacion.reenvio", entidad: "liquidacion", entidadId: liquidacionId, detalle: r });
  if (r.enviados + r.errores === 0) return ok("No había mails pendientes.");
  return r.errores ? error(`Se mandaron ${r.enviados}; ${r.errores} siguen con error.`) : ok(`Se mandaron ${r.enviados} mails.`);
}

export async function estadoEnvios(liquidacionId: string) {
  await exigirPermiso("liquidacion.publicar");
  const grupos = await db.envioMail.groupBy({ by: ["estado"], where: { tipo: "liquidacion", refId: liquidacionId }, _count: true });
  const cuenta = Object.fromEntries(grupos.map((g) => [g.estado, g._count])) as Partial<Record<"PENDIENTE" | "ENVIADO" | "ERROR", number>>;
  const conError = await db.envioMail.findMany({
    where: { tipo: "liquidacion", refId: liquidacionId, estado: "ERROR" },
    select: { destinatario: true, error: true },
    take: 20,
  });
  return { enviados: cuenta.ENVIADO ?? 0, pendientes: cuenta.PENDIENTE ?? 0, errores: cuenta.ERROR ?? 0, conError };
}

const anularSchema = z.object({
  motivo: textoSchema("el motivo", 500).pipe(z.string().min(10, "Contá el motivo con un poco más de detalle.")),
});

/**
 * Anula la última liquidación publicada y abre su corrección: un borrador del
 * mismo mes con todos sus datos copiados, que al publicarse sale como "rectificada".
 */
export async function anularLiquidacion(liquidacionId: string, input: unknown): Promise<Resultado & { borradorId?: string }> {
  const actor = await exigirPermiso("liquidacion.anular");
  const p = anularSchema.safeParse(input);
  if (!p.success) return erroresDeZod(p.error);

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "liquidacion" WHERE id = ${liquidacionId} FOR UPDATE`;
    const liq = await tx.liquidacion.findUnique({
      where: { id: liquidacionId },
      include: { ingresos: true, egresos: true, cargos: true, saldosIniciales: true },
    });
    if (!liq || liq.estado !== "PUBLICADA") return error("Solo se puede anular una liquidación publicada.");
    const posterior = await tx.liquidacion.findFirst({ where: { periodo: { gt: liq.periodo }, estado: { not: "ANULADA" } } });
    if (posterior) {
      return error(
        `Ya existe la liquidación de ${periodoEnFrase(posterior.periodo)}${posterior.estado === "BORRADOR" ? " (en preparación). Eliminá ese borrador" : ". Anulá esa primero"} para poder anular esta.`,
      );
    }
    if (await tx.liquidacion.findFirst({ where: { estado: "BORRADOR" } })) {
      return error("Hay otra liquidación en preparación. Eliminala antes de anular esta.");
    }

    await tx.liquidacion.update({
      where: { id: liq.id },
      data: { estado: "ANULADA", anuladaEn: new Date(), anuladaPorId: actor.userId, motivoAnulacion: p.data.motivo },
    });
    const nueva = await tx.liquidacion.create({
      data: {
        periodo: liq.periodo,
        tasaInteresPb: liq.tasaInteresPb,
        tasaFondoReservaPb: liq.tasaFondoReservaPb,
        diaVencimiento: liq.diaVencimiento,
        procedimientoPago: liq.procedimientoPago,
        disponibilidades: liq.disponibilidades ?? undefined,
        rectificaId: liq.id,
      },
    });
    const mapaIngresos = new Map<string, string>();
    for (const i of liq.ingresos) {
      const { id, liquidacionId: _l, createdAt: _c, ...datos } = i;
      const copia = await tx.ingreso.create({ data: { ...datos, liquidacionId: nueva.id } });
      mapaIngresos.set(id, copia.id);
    }
    await tx.egreso.createMany({ data: liq.egresos.map(({ id: _i, liquidacionId: _l, createdAt: _c, ...e }) => ({ ...e, liquidacionId: nueva.id })) });
    await tx.cargoExtra.createMany({ data: liq.cargos.map(({ id: _i, liquidacionId: _l, createdAt: _c, ...c }) => ({ ...c, liquidacionId: nueva.id })) });
    await tx.saldoInicial.createMany({ data: liq.saldosIniciales.map(({ id: _i, liquidacionId: _l, ...s }) => ({ ...s, liquidacionId: nueva.id })) });
    // Los depósitos cargados o identificados en la anulada pasan a la corrección.
    await tx.depositoNoIdentificado.updateMany({ where: { cargadoEnId: liq.id }, data: { cargadoEnId: nueva.id } });
    const identificados = await tx.depositoNoIdentificado.findMany({ where: { identificadoEnId: liq.id } });
    for (const d of identificados) {
      await tx.depositoNoIdentificado.update({
        where: { id: d.id },
        data: { identificadoEnId: nueva.id, ingresoId: d.ingresoId ? (mapaIngresos.get(d.ingresoId) ?? null) : null },
      });
    }
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: "liquidacion.anulada",
        entidad: "liquidacion",
        entidadId: liq.id,
        detalle: { periodo: liq.periodo, motivo: p.data.motivo, correccionId: nueva.id },
      },
      tx,
    );
    return { ...ok(`Anulaste la liquidación de ${periodoEnFrase(liq.periodo)}. Corregí lo necesario y publicala de nuevo.`), borradorId: nueva.id };
  });
}
