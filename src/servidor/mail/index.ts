import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Adjunto {
  nombre: string;
  tipo: string;
  contenido: Buffer;
}

export interface Mail {
  para: string;
  asunto: string;
  texto: string;
  html?: string;
  adjuntos?: Adjunto[];
}

/**
 * Envío de mails. Driver según MAIL_DRIVER:
 * - "archivo" (desarrollo y tests): guarda cada mail en storage/mails/*.json
 *   (y los adjuntos al lado, una sola vez por contenido). No sale nada.
 * - "resend": pendiente hasta definir el dominio (ver docs/PLAN.md, decisión 17).
 */
export async function enviarMail(mail: Mail): Promise<void> {
  const driver = process.env.MAIL_DRIVER ?? "archivo";
  if (driver === "archivo") {
    const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), process.env.MAIL_DIR ?? "storage/mails");
    await mkdir(dir, { recursive: true });
    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const adjuntos = [];
    for (const a of mail.adjuntos ?? []) {
      const archivo = `${nombre}-${a.nombre.replace(/[^\w.-]/g, "_")}`;
      await writeFile(path.join(dir, archivo), a.contenido);
      adjuntos.push({ nombre: a.nombre, tipo: a.tipo, tamano: a.contenido.length, archivo });
    }
    const { adjuntos: _, ...resto } = mail;
    await writeFile(path.join(dir, `${nombre}.json`), JSON.stringify({ ...resto, adjuntos, fecha: new Date() }, null, 2));
    return;
  }
  throw new Error(`MAIL_DRIVER "${driver}" no está configurado todavía.`);
}
