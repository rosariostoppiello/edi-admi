import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ingresar, ultimoMailPara } from "./utiles";

const PORTERIA = "porteria@example.com";
const main = (p: Page) => p.getByRole("main");

/** Mantiene apretado el botón de confirmación el tiempo indicado. */
async function mantener(page: Page, ms: number) {
  await page.getByRole("button", { name: /Mantené apretado para avisar/ }).hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function completarAviso(page: Page, lugar: string) {
  await page.goto("/emergencia");
  await expect(page.getByRole("heading", { name: "¿Ya llamaste al 911?" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Emergencias 911/ })).toHaveAttribute("href", "tel:911");
  await page.getByLabel("Olor a gas o fuga de gas").check();
  await page.getByLabel("¿Dónde? (opcional)").fill(lugar);
  await page.getByRole("button", { name: "Seguir" }).click();
  await expect(page.getByRole("heading", { name: "¿Estás seguro de que es una emergencia?" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("un toque corto no manda el aviso", async ({ page }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 12 : 13);
  await ingresar(page, u.duenoEmail);
  await completarAviso(page, `Prueba toque ${info.project.name}`);
  await mantener(page, 300);
  await expect(page.getByRole("heading", { name: "¿Estás seguro de que es una emergencia?" })).toBeVisible();
  await expect(main(page).getByText("Avisaste a Portería")).toHaveCount(0);
});

test("aviso de emergencia: la unidad avisa, Portería avisa a todos y lo cierra", async ({ browser }, info) => {
  // Único por corrida: la base de test conserva los avisos de corridas anteriores.
  const lugar = `Torre 2 piso ${info.project.name === "movil" ? 3 : 4} (${Date.now() % 100000})`;
  const u = await unidad(false, info.project.name === "movil" ? 14 : 15);

  // 1. La unidad avisa, con las dos confirmaciones.
  const vecino = await (await browser.newContext()).newPage();
  await ingresar(vecino, u.duenoEmail);
  await completarAviso(vecino, lugar);
  await mantener(vecino, 2400);
  await expect(main(vecino).getByRole("status")).toContainText("Avisaste a Portería y a la Administración");
  await expect(main(vecino).getByText(/No prendas luces/)).toBeVisible();

  // Le llega un mail a Portería, con quién avisó.
  const mail = await ultimoMailPara(PORTERIA, `EMERGENCIA: Gas en ${lugar}`);
  expect(mail.texto).toContain(`Avisó: `);
  expect(mail.texto).toContain(`Dónde: ${lugar}`);

  // Un segundo aviso enseguida no se manda.
  await completarAviso(vecino, lugar);
  await mantener(vecino, 2400);
  await expect(main(vecino).getByRole("alert")).toContainText("Ya mandaste un aviso hace un momento");

  // 2. Portería ve la franja roja y el detalle.
  const porteria = await (await browser.newContext()).newPage();
  await ingresar(porteria, PORTERIA);
  const franja = porteria.getByRole("alert").getByRole("listitem").filter({ hasText: `Emergencia activa: Gas en ${lugar}` });
  await expect(franja).toBeVisible();
  await franja.getByRole("link", { name: "Ver el aviso" }).click();
  await expect(porteria.getByRole("heading", { level: 1, name: "Olor a gas o fuga de gas" })).toBeVisible();

  // 3. Sin confirmar que es real, no se avisa a todos.
  await porteria.getByRole("button", { name: "Avisar a todas las unidades" }).click();
  await expect(main(porteria).getByText("Confirmá que comprobaste la emergencia.")).toBeVisible();
  await porteria.getByLabel("Comprobé que la emergencia es real").check();
  await porteria.getByRole("button", { name: "Avisar a todas las unidades" }).click();
  await expect(main(porteria).getByRole("status").first()).toContainText("Avisaste a todas las unidades");

  // Las unidades lo ven al entrar, sin saber quién avisó.
  await ultimoMailPara(u.duenoEmail, "Aviso de emergencia en el edificio");
  await vecino.goto("/inicio");
  await expect(vecino.getByRole("alert").getByRole("listitem").filter({ hasText: `en ${lugar}` })).toBeVisible();

  // 4. Portería lo cierra: desaparece la franja y les llega el fin.
  await porteria.getByRole("button", { name: "Cerrar el aviso" }).click();
  await expect(main(porteria).getByRole("status").first()).toContainText("Marcaste la emergencia como atendida");
  await ultimoMailPara(u.duenoEmail, "Terminó la emergencia en el edificio");
  await vecino.goto("/inicio");
  await expect(vecino.getByRole("alert").getByRole("listitem").filter({ hasText: `en ${lugar}` })).toHaveCount(0);
});

test("una unidad no ve la lista de avisos ni quién avisó", async ({ page }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 12 : 13);
  await ingresar(page, u.duenoEmail);
  await page.goto("/emergencia");
  await expect(page.getByRole("link", { name: "Ver los avisos de emergencia" })).toHaveCount(0);
  await page.goto("/emergencia/avisos");
  await expect(page.getByRole("heading", { level: 1, name: "Avisos de emergencia" })).toHaveCount(0);
});

test("la pantalla de inicio es pública y lleva a ingresar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Administración de Edificios de Propiedad Horizontal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "PropiedadH" }).first()).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("con sesión, la pantalla principal se ve y lleva al panel", async ({ page }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 12 : 13);
  await ingresar(page, u.duenoEmail);
  await page.getByRole("banner").getByRole("link", { name: "PropiedadH" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Administración de Edificios de Propiedad Horizontal" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "Ir a mi panel" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
});
