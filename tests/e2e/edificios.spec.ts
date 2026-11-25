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
  await elegir(page, /^(?!Edificio (Rambla|Prueba))/);
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
  await elegir(page, /^(?!Edificio (Rambla|Prueba))/);
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

test("un administrador pide un edificio nuevo y el dueño del sistema lo aprueba", async ({ browser }, info) => {
  const nombre = `Edificio Prueba ${info.project.name} ${Date.now() % 100000}`;

  const admin = await (await browser.newContext()).newPage();
  await ingresarVarios(admin, "admin.dos@example.com");
  await elegir(admin, /Edificio Rambla/);
  await admin.getByRole("link", { name: "Configuración del edificio" }).click();
  await admin.getByRole("link", { name: "Agregar un edificio" }).click();
  await admin.getByLabel("Nombre del edificio").fill(nombre);
  await admin.getByLabel("Torres").fill("1 Norte\n2 Sur");
  await admin.getByRole("button", { name: "Pedir el alta" }).click();
  await expect(main(admin).getByRole("status")).toContainText(`Pediste el alta de ${nombre}`);

  // El dueño del sistema lo ve y lo aprueba.
  const dueno = await (await browser.newContext()).newPage();
  await dueno.goto("/ingresar");
  await dueno.getByLabel("Mail").fill("dueno@example.com");
  await dueno.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await dueno.getByRole("button", { name: "Ingresar" }).click();
  await dueno.waitForURL((u) => u.pathname === "/inicio");
  await dueno.getByRole("link", { name: "Edificios del sistema" }).click();
  const pedido = main(dueno).getByRole("article", { name: `Pedido de ${nombre}` });
  await expect(pedido).toContainText("2 torres");
  await pedido.getByRole("button", { name: "Aprobar" }).click();
  await expect(main(dueno).getByRole("status").filter({ hasText: `Aprobaste ${nombre}` })).toBeVisible();

  // Ahora aparece entre los edificios de quien lo pidió.
  await admin.goto("/edificios");
  await expect(admin.getByRole("navigation", { name: "Edificios" }).getByRole("button", { name: new RegExp(nombre) })).toBeVisible();
});

test("un usuario sin ser dueño del sistema no entra a la revisión de edificios", async ({ page }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 18 : 19);
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(u.duenoEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(CLAVE);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((x) => x.pathname === "/inicio");
  await page.goto("/sistema");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await page.goto("/edificio");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("la piscina aparece solo en el edificio que la tiene", async ({ page }) => {
  await ingresarVarios(page, "ana.dos.edificios@example.com");
  await elegir(page, /Edificio Rambla/);
  await page.goto("/reservas");
  await page.getByRole("link", { name: "Piscina" }).click();
  await expect(main(page)).toContainText("de diciembre a marzo");

  await page.getByRole("banner").getByRole("link", { name: /cambiar de edificio/ }).click();
  await elegir(page, /^(?!Edificio (Rambla|Prueba))/);
  await page.goto("/reservas");
  await expect(main(page).getByRole("link", { name: "Piscina" })).toHaveCount(0);
  await page.goto("/reservas/piscina");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("un módulo apagado no aparece en el inicio y su sección no existe", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio", "Cambia la configuración de Rambla: una sola vez por corrida");
  await ingresarVarios(page, "admin.dos@example.com");
  await elegir(page, /Edificio Rambla/);
  await page.goto("/edificio");
  await page.getByLabel("Comunicados de la Administración").uncheck();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(main(page).getByRole("status")).toContainText("Guardaste los módulos");

  await page.goto("/inicio");
  const secciones = page.getByRole("navigation", { name: "Secciones" });
  await expect(secciones.getByRole("link")).toHaveCount(5);
  await expect(secciones.getByRole("link", { name: /Comunicados/ })).toHaveCount(0);
  await page.goto("/comunicados/avisos");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();

  // Se vuelve a prender (deja Rambla como estaba).
  await page.goto("/edificio");
  await page.getByLabel("Comunicados de la Administración").check();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(main(page).getByRole("status")).toContainText("Guardaste los módulos");
});
