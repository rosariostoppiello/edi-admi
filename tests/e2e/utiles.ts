import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { expect, type Page } from "@playwright/test";
import "dotenv/config";

export const CLAVE = process.env.SEED_PASSWORD!;
export const ADMIN = "admin@example.com";
/** Primer dueño del seed: Comisión + propietario de 2-101 y de un garaje. */
export const VECINA = "laura.pereira.1@example.com";
/** Usuarios a los que el test de recuperación les cambia la contraseña (uno por proyecto). */
export const USUARIOS_RESET = { movil: "martin.olivera.2@example.com", escritorio: "valentina.piriz.3@example.com" } as const;

export async function ingresar(page: Page, email: string, clave = CLAVE) {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
    page.getByRole("button", { name: "Ingresar" }).click(),
  ]);
  // Si el login salió bien, esperar a que termine la navegación al inicio.
  if (respuesta.ok()) await page.waitForURL((u) => u.pathname === "/inicio");
}

/** Último mail "enviado" (driver archivo) a un destinatario (y con ese asunto, si se indica). */
export async function ultimoMailPara(destinatario: string, asunto?: string) {
  const dir = path.join(process.cwd(), "storage", "mails-e2e");
  let encontrado: { para: string; asunto: string; texto: string; adjuntos?: { nombre: string; archivo: string }[] } | undefined;
  await expect
    .poll(() => {
      let archivos: string[] = [];
      try {
        archivos = readdirSync(dir)
          .filter((a) => a.endsWith(".json"))
          .sort();
      } catch {
        return false;
      }
      encontrado = archivos
        .map((a) => JSON.parse(readFileSync(path.join(dir, a), "utf8")))
        .filter((m) => m.para === destinatario && (!asunto || m.asunto === asunto))
        .at(-1);
      return Boolean(encontrado);
    })
    .toBe(true);
  return encontrado!;
}

/**
 * Texto de un PDF de @react-pdf (fuentes estándar): descomprime cada stream y
 * junta las cadenas de los operadores Tj/TJ. Alcanza para buscar encabezados.
 * Devuelve el texto sin espacios ni saltos (una palabra puede partirse en renglones).
 */
export function textoPdf(pdf: Buffer): string {
  const crudo = pdf.toString("latin1");
  let texto = "";
  for (const m of crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let contenido: string;
    try {
      contenido = inflateSync(Buffer.from(m[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    for (const op of contenido.matchAll(/\[(.*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj/g)) {
      for (const hex of (op[1] ?? `<${op[2]}>`).matchAll(/<([0-9a-fA-F]+)>/g)) texto += Buffer.from(hex[1], "hex").toString("latin1");
    }
  }
  return texto.replace(/\s+/g, "");
}

export const sinEspacios = (s: string) => s.replace(/\s+/g, "");
