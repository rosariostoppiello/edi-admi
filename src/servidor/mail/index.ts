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
 * - "resend" (producción): API HTTP de Resend con RESEND_API_KEY y MAIL_FROM de un
 *   dominio verificado (docs/PLAN.md, decisiones 17 y 73). Sin SDK: un fetch.
 * En producción no se usa "archivo" (el disco del hosting es de solo lectura).
 */
export async function enviarMail(mail: Mail): Promise<void> {
  const driver = process.env.MAIL_DRIVER ?? (process.env.VERCEL ? "resend" : "archivo");
  if (driver === "resend") return enviarConResend(mail);
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

const REMITENTE_POR_DEFECTO = "Administración <no-responder@example.com>";

async function enviarConResend(mail: Mail): Promise<void> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) throw new Error("Falta RESEND_API_KEY para mandar mails.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? REMITENTE_POR_DEFECTO,
      to: [mail.para],
      subject: mail.asunto,
      text: mail.texto,
      ...(mail.html ? { html: mail.html } : {}),
      ...(mail.adjuntos?.length
        ? { attachments: mail.adjuntos.map((a) => ({ filename: a.nombre, content: a.contenido.toString("base64"), content_type: a.tipo })) }
        : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) {
    // El cuerpo de error de Resend no trae datos personales; se guarda corto para el reintento.
    throw new Error(`Resend respondió ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
}
