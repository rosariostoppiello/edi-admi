import "server-only";
import { db } from "../db";
import { exigirPermiso, type UsuarioActual } from "../sesion";
import { puede } from "@/dominio/permisos";
import { esDueno } from "@/dominio/personas";
import { NOMBRE_COMPLEJO } from "@/lib/edificio";
import { armarLiquidacion, configuracion } from "./armado";
import { generarPdf, nombreArchivoPdf } from "./pdf";

/**
 * Líneas que un usuario puede ver como "suyas":
 * - el responsable (A/P) ve todas las líneas de su unidad (responde por la deuda);
 * - el inquilino ve solo la línea I, y solo desde el mes en que entró
 *   (no la de un inquilino anterior).
 */
async function filtroLineasPropias(usuario: UsuarioActual) {
  if (usuario.unidades.length === 0) return null;
  const personas = await db.persona.findMany({
    where: { id: { in: usuario.unidades.map((u) => u.personaId) }, activa: true },
    select: { unidadId: true, calidad: true, altaEn: true },
  });
  return personas.map((p) =>
    esDueno(p.calidad)
      ? { unidadId: p.unidadId }
      : { unidadId: p.unidadId, sufijo: "I" as const, liquidacion: { periodo: { gte: p.altaEn.toISOString().slice(0, 7) } } },
  );
}

/** Liquidaciones visibles: publicadas para todos; anuladas solo para Administración y Comisión. */
export async function listarLiquidaciones() {
  const usuario = await exigirPermiso("liquidacion.ver");
  const veAnuladas = puede(usuario, "liquidacion.verConsolidado");
  const liquidaciones = await db.liquidacion.findMany({
    where: { estado: veAnuladas ? { in: ["PUBLICADA", "ANULADA"] } : "PUBLICADA" },
    orderBy: [{ periodo: "desc" }, { createdAt: "desc" }],
    select: { id: true, periodo: true, estado: true, publicadaEn: true, rectificaId: true, motivoAnulacion: true },
  });
  const filtro = await filtroLineasPropias(usuario);
  const propias = filtro
    ? await db.lineaLiquidacion.findMany({
        where: { OR: filtro, liquidacion: { estado: "PUBLICADA" } },
        select: { liquidacionId: true, codigo: true, saldoAPagar: true },
        orderBy: { orden: "asc" },
      })
    : [];
  return liquidaciones.map((l) => ({ ...l, propias: propias.filter((p) => p.liquidacionId === l.id) }));
}

/** Una liquidación publicada del período, con las líneas propias del usuario. */
export async function verLiquidacion(periodo: string, liquidacionId?: string) {
  const usuario = await exigirPermiso("liquidacion.ver");
  const veConsolidado = puede(usuario, "liquidacion.verConsolidado");
  const liq = liquidacionId
    ? await db.liquidacion.findFirst({ where: { id: liquidacionId, periodo, estado: veConsolidado ? { in: ["PUBLICADA", "ANULADA"] } : "PUBLICADA" } })
    : await db.liquidacion.findFirst({ where: { periodo, estado: "PUBLICADA" } });
  if (!liq) return null;

  const filtro = await filtroLineasPropias(usuario);
  const propias = filtro
    ? await db.lineaLiquidacion.findMany({ where: { liquidacionId: liq.id, OR: filtro }, orderBy: { orden: "asc" } })
    : [];
  // El consolidado (todas las unidades) solo para Administración y Comisión.
  const armada = veConsolidado ? await armarLiquidacion(liq.id) : null;
  return { liquidacion: liq, propias, armada, usuario };
}

/** La última liquidación publicada (la rectificada, si hubo anulación). */
export async function verUltima() {
  await exigirPermiso("liquidacion.ver");
  const ultima = await db.liquidacion.findFirst({
    where: { estado: "PUBLICADA" },
    orderBy: [{ periodo: "desc" }, { publicadaEn: "desc" }],
    select: { id: true, periodo: true },
  });
  return ultima ? verLiquidacion(ultima.periodo, ultima.id) : null;
}

/**
 * PDF con control de acceso. El PDF de una publicada lo ve todo usuario
 * (decisión 13); el de un borrador, solo Administración; el de una anulada,
 * Administración y Comisión (lleva el sello "ANULADA").
 */
export async function obtenerPdf(liquidacionId: string): Promise<{ nombre: string; datos: Buffer } | null> {
  const usuario = await exigirPermiso("liquidacion.ver");
  const liq = await db.liquidacion.findUnique({ where: { id: liquidacionId }, include: { pdf: true } });
  if (!liq) return null;
  if (liq.estado === "BORRADOR" && !puede(usuario, "liquidacion.confeccionar")) return null;
  if (liq.estado === "ANULADA" && !puede(usuario, "liquidacion.verConsolidado")) return null;

  if (liq.estado === "PUBLICADA" && liq.pdf) return { nombre: liq.pdf.nombre, datos: Buffer.from(liq.pdf.datos) };

  const armada = (await armarLiquidacion(liq.id))!;
  const cfg = await configuracion();
  const datos = await generarPdf(armada, NOMBRE_COMPLEJO, cfg.direccion);
  const nombre = nombreArchivoPdf(liq.periodo, liq.estado);
  if (liq.estado === "PUBLICADA") {
    // Publicada sin PDF guardado (ej. datos de ejemplo): se guarda para la próxima.
    const archivo = await db.archivo.create({ data: { nombre, tipo: "application/pdf", tamano: datos.length, datos: new Uint8Array(datos) } });
    await db.liquidacion.updateMany({ where: { id: liq.id, pdfId: null }, data: { pdfId: archivo.id } });
  }
  return { nombre, datos };
}
