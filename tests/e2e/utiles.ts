import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
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
  await page.getByLabel("Contraseña").fill(clave);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/sign-in/email")),
    page.getByRole("button", { name: "Ingresar" }).click(),
  ]);
  // Si el login salió bien, esperar a que termine la navegación al inicio.
  if (respuesta.ok()) await page.waitForURL((u) => u.pathname === "/");
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
