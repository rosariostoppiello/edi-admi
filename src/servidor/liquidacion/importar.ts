import "server-only";
import ExcelJS from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { registrarAuditoria } from "../auditoria";
import { exigirPermiso } from "../sesion";
import { error, ok, type Resultado } from "../resultado";
import { formatearPesos, type Centesimos } from "@/dominio/dinero";
import {
  leerCsv,
  validarIngresos,
  validarSaldosIniciales,
  type Celda,
  type FilaImportada,
  type ResultadoImportacion,
} from "@/dominio/liquidacion/importacion";
import { fechaIso } from "@/dominio/liquidacion/periodo";
import { esPrimera } from "./armado";
import { unidadesConocidas } from "./confeccion";

export const MAX_BYTES = 3 * 1024 * 1024;

/** Valor "plano" de una celda de exceljs (fórmulas → resultado, texto enriquecido → texto). */
function valorCelda(v: ExcelJS.CellValue): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (typeof v === "object") {
    if ("result" in v) return valorCelda(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
  }
  return String(v);
}

async function leerArchivo(archivo: File): Promise<Celda[][]> {
  const nombre = archivo.name.toLowerCase();
  const bytes = Buffer.from(await archivo.arrayBuffer());
  if (nombre.endsWith(".csv")) return leerCsv(bytes.toString("utf8"));
  if (!nombre.endsWith(".xlsx")) throw new Error("formato");
  const libro = new ExcelJS.Workbook();
  // exceljs tipa el buffer con su propia definición; el Buffer de Node sirve.
  await libro.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const hoja = libro.worksheets[0];
  if (!hoja) return [];
  const filas: Celda[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila, numero) => {
    const valores = Array.isArray(fila.values) ? fila.values.slice(1) : [];
    filas[numero - 1] = valores.map((v) => valorCelda(v as ExcelJS.CellValue));
  });
  return Array.from(filas, (f) => f ?? []);
}

/** Sube una planilla y guarda la vista previa (no toca la liquidación todavía). */
export async function subirPlanilla(
  liquidacionId: string,
  tipo: "INGRESOS" | "SALDOS_INICIALES",
  archivo: unknown,
): Promise<Resultado & { importacionId?: string }> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  if (!(archivo instanceof File) || archivo.size === 0) return error("Elegí la planilla (.xlsx o .csv).");
  if (archivo.size > MAX_BYTES) return error("La planilla pesa más de 3 MB. Dividila en partes.");

  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId } });
  if (!liq || liq.estado !== "BORRADOR") return error("Esta liquidación ya no se puede modificar.");
  if (tipo === "SALDOS_INICIALES" && !(await esPrimera(liq.periodo))) {
    return error("Los saldos iniciales solo se cargan en la primera liquidación. Las siguientes toman el saldo del mes anterior.");
  }

  let celdas: Celda[][];
  try {
    celdas = await leerArchivo(archivo);
  } catch (e) {
    if ((e as Error).message === "formato") return error("El archivo tiene que ser una planilla .xlsx o .csv.");
    return error("No pudimos leer la planilla. Guardala de nuevo como .xlsx y volvé a subirla.");
  }

  const unidades = await unidadesConocidas();
  let r: ResultadoImportacion;
  if (tipo === "INGRESOS") {
    const existentes = await db.ingreso.findMany({ where: { liquidacionId }, select: { unidadId: true, sufijo: true, fecha: true, monto: true } });
    r = validarIngresos(celdas, {
      periodo: liq.periodo,
      unidades,
      existentes: existentes.map((x) => ({ ...x, fecha: fechaIso(x.fecha) })),
    });
  } else {
    r = validarSaldosIniciales(celdas, { unidades });
  }
  if (r.error) return error(r.error);

  const imp = await db.$transaction(async (tx) => {
    // Solo una vista previa pendiente por tipo.
    await tx.importacion.updateMany({ where: { liquidacionId, tipo, estado: "PENDIENTE" }, data: { estado: "DESCARTADA" } });
    return tx.importacion.create({
      data: {
        liquidacionId,
        tipo,
        archivoNombre: archivo.name.slice(0, 120),
        filas: r.filas as unknown as Prisma.InputJsonValue,
        errores: r.cantidadErrores,
        usuarioId: actor.userId,
      },
    });
  });
  return { ...ok("Revisá la vista previa antes de confirmar."), importacionId: imp.id };
}

export async function importacionPendiente(liquidacionId: string, tipo: "INGRESOS" | "SALDOS_INICIALES") {
  await exigirPermiso("liquidacion.confeccionar");
  const imp = await db.importacion.findFirst({ where: { liquidacionId, tipo, estado: "PENDIENTE" }, orderBy: { createdAt: "desc" } });
  if (!imp) return null;
  const filas = imp.filas as unknown as FilaImportada[];
  return {
    id: imp.id,
    archivoNombre: imp.archivoNombre,
    filas,
    errores: imp.errores,
    total: filas.filter((f) => f.errores.length === 0).reduce((s, f) => s + (f.monto ?? 0), 0),
  };
}

export async function descartarImportacion(liquidacionId: string, importacionId: string): Promise<Resultado> {
  await exigirPermiso("liquidacion.confeccionar");
  await db.importacion.updateMany({ where: { id: importacionId, liquidacionId, estado: "PENDIENTE" }, data: { estado: "DESCARTADA" } });
  return ok("Descartaste la planilla. No se cargó nada.");
}

/**
 * Confirma la planilla: carga todas sus filas. Si alguna tiene errores no se
 * carga ninguna (hay que corregir la planilla y subirla de nuevo).
 */
export async function confirmarImportacion(liquidacionId: string, importacionId: string): Promise<Resultado> {
  const actor = await exigirPermiso("liquidacion.confeccionar");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "liquidacion" WHERE id = ${liquidacionId} FOR UPDATE`;
    const liq = await tx.liquidacion.findUnique({ where: { id: liquidacionId } });
    if (!liq || liq.estado !== "BORRADOR") return error("Esta liquidación ya no se puede modificar.");
    const imp = await tx.importacion.findFirst({ where: { id: importacionId, liquidacionId, estado: "PENDIENTE" } });
    if (!imp) return error("Esa planilla ya se confirmó o se descartó.");
    if (imp.errores > 0) return error("La planilla tiene errores. Corregilos y subila de nuevo.");

    // Las unidades pudieron cambiar (A ↔ P+I) desde que se subió: se revalida.
    const vigentes = new Map((await unidadesConocidas(tx)).map((u) => [u.unidadId, u]));
    const filas = imp.filas as unknown as FilaImportada[];
    for (const f of filas) {
      const u = vigentes.get(f.unidadId!);
      if (!u || (u.arrendada ? f.sufijo === "A" : f.sufijo !== "A")) {
        return error(`La unidad ${f.codigo} cambió desde que subiste la planilla. Subila de nuevo.`);
      }
    }

    const total = filas.reduce((s, f) => s + (f.monto ?? 0), 0);
    if (imp.tipo === "INGRESOS") {
      await tx.ingreso.createMany({
        data: filas.map((f) => ({
          liquidacionId,
          unidadId: f.unidadId!,
          sufijo: f.sufijo!,
          fecha: new Date(`${f.fecha}T00:00:00Z`),
          monto: f.monto!,
          referencia: f.referencia,
          origen: "EXCEL" as const,
          importacionId: imp.id,
          creadoPorId: actor.userId,
        })),
      });
    } else {
      // Los saldos iniciales se reemplazan completos.
      await tx.saldoInicial.deleteMany({ where: { liquidacionId } });
      await tx.saldoInicial.createMany({
        data: filas.map((f) => ({ liquidacionId, unidadId: f.unidadId!, sufijo: f.sufijo!, monto: f.monto! })),
      });
    }
    await tx.importacion.update({ where: { id: imp.id }, data: { estado: "CONFIRMADA", confirmadaEn: new Date() } });
    await registrarAuditoria(
      {
        usuarioId: actor.userId,
        accion: imp.tipo === "INGRESOS" ? "ingresos.importados" : "saldos_iniciales.importados",
        entidad: "liquidacion",
        entidadId: liquidacionId,
        detalle: { importacionId: imp.id, archivo: imp.archivoNombre, filas: filas.length, total },
      },
      tx,
    );
    return ok(
      imp.tipo === "INGRESOS"
        ? `Cargaste ${filas.length} ${filas.length === 1 ? "pago" : "pagos"} por ${formatearPesos(total as Centesimos)}.`
        : `Cargaste los saldos iniciales de ${filas.length} líneas.`,
    );
  });
}

export async function resumenSaldosIniciales(liquidacionId: string) {
  await exigirPermiso("liquidacion.confeccionar");
  const r = await db.saldoInicial.aggregate({ where: { liquidacionId }, _count: true, _sum: { monto: true } });
  return { cantidad: r._count, total: r._sum.monto ?? 0 };
}
