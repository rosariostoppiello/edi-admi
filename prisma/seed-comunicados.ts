/** Comunicados de ejemplo (textos inventados) con PDF mínimos generados acá. */
import type { PrismaClient } from "../src/generated/prisma/client";
import { EDIFICIO } from "./seed-edificio";

/** PDF válido de una página con una línea de texto (Helvetica, sin dependencias). */
export function pdfMinimo(texto: string): Uint8Array<ArrayBuffer> {
  const limpio = texto.replace(/[()\\]/g, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const contenido = `BT /F1 18 Tf 72 720 Td (${limpio}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

const fecha = (f: string) => new Date(`${f}T00:00:00Z`);

export async function limpiarComunicados(db: PrismaClient) {
  const ids = (await db.comunicado.findMany({ select: { archivoId: true } })).map((c) => c.archivoId).filter((x): x is string => Boolean(x));
  await db.comunicado.deleteMany();
  await db.archivo.deleteMany({ where: { id: { in: ids } } });
}

export async function sembrarComunicados(db: PrismaClient) {
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
  const docs = [
    { tipo: "REGLAMENTO", titulo: "Reglamento de copropiedad", fecha: "2020-03-01", orden: 1 },
    { tipo: "REGLAMENTO", titulo: "Reglamento de barbacoas", fecha: "2023-05-10", orden: 2 },
    { tipo: "REGLAMENTO", titulo: "Reglamento interno", fecha: "2021-08-15", orden: 3 },
    { tipo: "ACTA", titulo: "Asamblea ordinaria de abril 2026", fecha: "2026-04-20", cuerpo: "Se aprobó el presupuesto anual y la pintura de los halls." },
  ] as const;
  for (const d of docs) {
    const datos = pdfMinimo(`${d.titulo} (documento de prueba)`);
    const archivo = await db.archivo.create({ data: { nombre: `${d.titulo}.pdf`, tipo: "application/pdf", tamano: datos.length, datos } });
    await db.comunicado.create({
      data: { edificioId: EDIFICIO, tipo: d.tipo, titulo: d.titulo, fecha: fecha(d.fecha), cuerpo: "cuerpo" in d ? d.cuerpo : "", archivoId: archivo.id, publicadoPorId: admin.id, orden: "orden" in d ? d.orden : 0 },
    });
  }
  await db.comunicado.createMany({
    data: [
      { edificioId: EDIFICIO, tipo: "AVISO", titulo: "Corte de agua programado", fecha: fecha("2026-11-10"), cuerpo: "El jueves 12 de 9 a 13 h se corta el agua en las torres 2 y 3 por mantenimiento de bombas.", publicadoPorId: admin.id },
      { edificioId: EDIFICIO, tipo: "AVISO", titulo: "Fumigación de espacios comunes", fecha: fecha("2026-10-28"), cuerpo: "El lunes 3 se fumigan los garajes y los depósitos. Retirá lo que tengas en el piso.", publicadoPorId: admin.id },
    ],
  });
  return docs.length + 2;
}
