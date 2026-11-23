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
 * - "smtp" (producción con una cuenta de Gmail, decisión 77): SMTP_USER y SMTP_PASS
 *   (contraseña de aplicación de Google); el remitente es esa cuenta.
 * - "resend": API HTTP de Resend, para cuando haya un dominio propio verificado.
 * - "ninguno": no manda nada (solo lo registra en el log).
 * En el hosting no se usa "archivo" (el disco es de solo lectura).
 * Nunca se manda a example.com (dominio reservado de los datos ficticios): se omite.
 */
export async function enviarMail(mail: Mail): Promise<void> {
  const driver = process.env.MAIL_DRIVER ?? (process.env.VERCEL ? "smtp" : "archivo");
  if (driver !== "archivo" && esFicticio(mail.para)) {
    console.info(`Mail omitido (destinatario ficticio): ${mail.asunto}`);
    return;
  }
  if (driver === "smtp") return enviarPorSmtp(mail);
  if (driver === "resend") return enviarConResend(mail);
  if (driver === "ninguno") {
    console.info(`Mail no enviado (MAIL_DRIVER=ninguno): ${mail.asunto}`);
    return;
  }
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

/** example.com y sus subdominios son reservados (RFC 2606): no existen casillas reales. */
export function esFicticio(email: string): boolean {
  return /@([\w-]+\.)*example\.(com|org|net)$/i.test(email.trim());
}

let transporte: import("nodemailer").Transporter | null = null;

async function enviarPorSmtp(mail: Mail): Promise<void> {
  const usuario = process.env.SMTP_USER;
  const clave = process.env.SMTP_PASS;
  if (!usuario || !clave) throw new Error("Faltan SMTP_USER y SMTP_PASS para mandar mails.");
  if (!transporte) {
    const { createTransport } = await import("nodemailer");
    transporte = createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: { user: usuario, pass: clave },
      connectionTimeout: 15_000,
    });
  }
  // Gmail usa siempre la cuenta autenticada como remitente; el nombre sale de MAIL_FROM.
  const nombre = /^(.*?)\s*</.exec(process.env.MAIL_FROM ?? "")?.[1] || "Administración";
  await transporte.sendMail({
    from: { name: nombre, address: usuario },
    to: mail.para,
    subject: mail.asunto,
    text: mail.texto,
    ...(mail.html ? { html: mail.html } : {}),
    attachments: mail.adjuntos?.map((a) => ({ filename: a.nombre, content: a.contenido, contentType: a.tipo })),
  });
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

/**
 * Aviso que no debe hacer fallar la acción que lo dispara (la solicitud, la respuesta
 * o el aviso ya quedaron guardados): si el mail falla, queda en el log.
 */
export async function avisar(mail: Mail): Promise<void> {
  try {
    await enviarMail(mail);
  } catch (e) {
    console.error(`No se pudo mandar el mail "${mail.asunto}":`, (e as Error).message);
  }
}
