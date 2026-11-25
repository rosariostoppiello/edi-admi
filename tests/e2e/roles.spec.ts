import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar } from "./utiles";

/**
 * Cada rol recorre su inicio, los 6 módulos y todos sus sub-botones. En cada pantalla:
 * carga bien (h1, sin "no encontramos"), sin scroll horizontal y sin errores de
 * accesibilidad WCAG 2.1 AA según axe.
 */
async function revisar(page: Page, donde: string) {
  await expect(page.getByRole("heading", { level: 1 }).first(), donde).toBeVisible();
  await expect(page.getByRole("heading", { name: "No encontramos esta página" }), donde).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${donde}: scroll horizontal`).toBeLessThanOrEqual(0);
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(graves, `${donde}: accesibilidad`).toEqual([]);
}

async function recorrer(page: Page) {
  await revisar(page, "inicio");
  const modulos = await page.getByRole("navigation", { name: "Secciones" }).getByRole("link").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(modulos).toHaveLength(6);
  for (const m of modulos) {
    await page.goto(m);
    await revisar(page, m);
    const titulo = await page.getByRole("heading", { level: 1 }).first().textContent();
    const subs = await page
      .getByRole("main")
      .getByRole("navigation", { name: titulo ?? "" })
      .getByRole("link")
      .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const s of subs) {
      await page.goto(s);
      await revisar(page, s);
    }
  }
}

test("una unidad recorre todo sin errores de accesibilidad", async ({ page }) => {
  test.slow();
  const u = await unidad(false, 9);
  await ingresar(page, u.duenoEmail);
  await recorrer(page);
});

for (const [rol, email] of [
  ["Administración", ADMIN],
  ["Portería", "porteria@example.com"],
  ["Comisión", "comision@example.com"],
] as const) {
  test(`${rol} recorre todo sin errores de accesibilidad`, async ({ page }) => {
    test.slow();
    await ingresar(page, email);
    await recorrer(page);
  });
}

test("las pantallas internas de Administración tampoco tienen errores de accesibilidad", async ({ page }) => {
  test.slow();
  await ingresar(page, ADMIN);
  for (const ruta of ["/liquidaciones/ultima", "/liquidaciones/anteriores", "/reservas/espacios", "/solicitudes/bandeja", "/datos/unidades", "/datos/nueva"]) {
    await page.goto(ruta);
    await revisar(page, ruta);
  }
  // Detalle de una solicitud y ficha de una unidad.
  await page.goto("/solicitudes/bandeja");
  await page.getByRole("main").getByRole("link", { name: /No funciona la luz del palier/ }).click();
  await revisar(page, "detalle de solicitud");
  const u = await unidad(false, 9);
  await page.goto(`/datos/${u.unidadId}`);
  await revisar(page, "ficha de unidad");
});

test("la pantalla de inicio, la de emergencia y los avisos no tienen errores de accesibilidad", async ({ page }) => {
  await page.goto("/");
  await revisar(page, "pantalla de inicio");
  await ingresar(page, "porteria@example.com");
  for (const ruta of ["/emergencia", "/emergencia/avisos"]) {
    await page.goto(ruta);
    await revisar(page, ruta);
  }
});
