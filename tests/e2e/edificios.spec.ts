import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { CLAVE } from "./utiles";

const main = (p: Page) => p.getByRole("main");

/** Login de un usuario con varios edificios: termina en la pantalla para elegir. */
async function ingresarVarios(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((u) => u.pathname === "/edificios");
  await expect(page.getByRole("heading", { level: 1, name: "Elegí el edificio" })).toBeVisible();
}

async function elegir(page: Page, nombre: RegExp) {
  await page.getByRole("navigation", { name: "Edificios" }).getByRole("button", { name: nombre }).click();
  await page.waitForURL((u) => u.pathname === "/inicio");
}

test("una vecina con apartamento en dos edificios elige el edificio y cambia desde la cabecera", async ({ page }) => {
  await ingresarVarios(page, "ana.dos.edificios@example.com");
  await expect(page.getByRole("navigation", { name: "Edificios" }).getByRole("button")).toHaveCount(2);

  await elegir(page, /Edificio Rambla/);
  const cabecera = page.getByRole("banner");
  await expect(cabecera).toContainText("Edificio Rambla");
  await expect(cabecera).toContainText("2-301-A");

  // Cambia al otro edificio desde la cabecera: ahí su unidad es la 5-601.
  await cabecera.getByRole("link", { name: /cambiar de edificio/ }).click();
  await elegir(page, /^(?!Edificio Rambla)/);
  await expect(cabecera).toContainText("5-601-A");
  await expect(cabecera).not.toContainText("Edificio Rambla");
});

test("una administradora de dos edificios ve solo las unidades del edificio activo", async ({ page }) => {
  const principal = await unidad(false, 0);
  await ingresarVarios(page, "admin.dos@example.com");
  await elegir(page, /Edificio Rambla/);

  await page.goto("/datos/unidades");
  await expect(main(page)).toContainText("5 unidades");
  await expect(main(page)).toContainText("2-301");
  await expect(main(page)).not.toContainText("3-101");

  // Una unidad del otro edificio no se puede abrir desde Rambla.
  await page.goto(`/datos/${principal.unidadId}`);
  await expect(page.locator("body")).toContainText(/No (encontramos|tenés permiso)/);
  await expect(page.locator("body")).not.toContainText(principal.duenoEmail);

  // En el edificio principal sí.
  await page.getByRole("banner").getByRole("link", { name: /cambiar de edificio/ }).click();
  await elegir(page, /^(?!Edificio Rambla)/);
  await page.goto(`/datos/${principal.unidadId}`);
  await expect(main(page)).toContainText(principal.duenoEmail);
});

test("un usuario de un solo edificio no ve la pantalla para elegir", async ({ page }) => {
  const u = await unidad(false, 18);
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(u.duenoEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((x) => x.pathname === "/inicio");
  await expect(page.getByRole("banner").getByRole("link", { name: /cambiar de edificio/ })).toHaveCount(0);
  await page.goto("/edificios");
  await expect(page).toHaveURL(/\/inicio$/);
});
