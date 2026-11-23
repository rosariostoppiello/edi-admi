import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar } from "./utiles";

// Sub-botones de cada módulo según "Proyecto en gráfico" (docs/PROYECTO-EN-GRAFICO.md, C.0).
const main = (page: Page) => page.getByRole("main");
const teclas = (page: Page) => main(page).getByRole("navigation").getByRole("link");

const SUBBOTONES: [string, string, string[]][] = [
  ["Reserva de espacios comunes", "/reservas", ["Barbacoas", "Solarium", "Laundry"]],
  ["Solicitudes varias", "/solicitudes", ["Aviso de desperfectos", "Consultas de gastos comunes", "Inquietudes varias"]],
  ["Comunicados de la Administración", "/comunicados", ["Avisos importantes", "Reglamentos", "Actas de asambleas"]],
  [
    "Teléfonos y datos de interés",
    "/telefonos",
    ["Administración", "Comisión administradora", "Portería", "Empresas", "Servicios públicos", "Seguro de incendio"],
  ],
];

test("una unidad recorre los módulos por sus sub-botones, en el orden del gráfico", async ({ page }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 10 : 11);
  await ingresar(page, u.duenoEmail);

  for (const [modulo, ruta, subbotones] of SUBBOTONES) {
    await page.goto("/");
    await page.getByRole("link", { name: new RegExp(modulo) }).click();
    await expect(page).toHaveURL(new RegExp(`${ruta}$`));
    await expect(teclas(page)).toHaveText(subbotones);
    // Teclas de al menos 44 px de alto y sin scroll horizontal de la página.
    for (const alto of await teclas(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
      expect(alto).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  }

  // Liquidación: la unidad no ve Confección y salta directo a Liquidación mensual.
  await page.goto("/");
  await page.getByRole("link", { name: /Liquidación de gastos comunes/ }).click();
  await expect(page).toHaveURL(/\/liquidaciones\/mensual$/);
  await expect(teclas(page)).toHaveText(["Última liquidación", "Liquidaciones anteriores"]);
  await page.getByRole("link", { name: "Inicio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/liquidaciones/confeccion");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("Administración ve Confección; Portería no", async ({ page }) => {
  await ingresar(page, ADMIN);
  await page.goto("/liquidaciones");
  await expect(teclas(page)).toHaveText(["Liquidación mensual", "Confección de la liquidación mensual"]);
  await main(page).getByRole("link", { name: "Liquidación mensual", exact: true }).click();
  await expect(page.getByRole("link", { name: "Liquidación de gastos comunes" })).toBeVisible();
  await page.getByRole("button", { name: "Salir" }).click();

  await ingresar(page, "porteria@example.com");
  await page.goto("/liquidaciones");
  await expect(page).toHaveURL(/\/liquidaciones\/mensual$/);
  await main(page).getByRole("link", { name: "Última liquidación" }).click();
  await expect(main(page).getByRole("link", { name: /Ver la liquidación completa/ })).toBeVisible();
});
