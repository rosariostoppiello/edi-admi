import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import "dotenv/config";

export const CLAVE = process.env.SEED_PASSWORD!;
export const ADMIN = "admin@example.com";
/** Primer dueño del seed: Comisión + propietario de 2-101 y de un garaje. */
export const VECINA = "laura.pereira.1@example.com";

export async function ingresar(page: Page, email: string, clave = CLAVE) {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

/** Último mail "enviado" (driver archivo) a un destinatario. */
export async function ultimoMailPara(destinatario: string) {
  const dir = path.join(process.cwd(), "storage", "mails-e2e");
  let encontrado: { para: string; asunto: string; texto: string } | undefined;
  await expect
    .poll(() => {
      let archivos: string[] = [];
      try {
        archivos = readdirSync(dir).sort();
      } catch {
        return false;
      }
      encontrado = archivos
        .map((a) => JSON.parse(readFileSync(path.join(dir, a), "utf8")))
        .filter((m) => m.para === destinatario)
        .at(-1);
      return Boolean(encontrado);
    })
    .toBe(true);
  return encontrado!;
}
