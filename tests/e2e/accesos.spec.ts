import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";

const main = (p: Page) => p.getByRole("main");

async function pedir(page: Page, datos: { nombre: string; email: string; codigo: string; calidad: string }) {
  await page.goto("/ingresar");
  await expect(page.getByRole("heading", { name: "¿No tenés usuario?" })).toBeVisible();
  await page.getByRole("link", { name: "Pedir acceso" }).click();
  await expect(page).toHaveURL(/\/pedir-acceso$/);
  await page.getByLabel("Nombre y apellido").fill(datos.nombre);
  await page.getByLabel("Mail").fill(datos.email);
  await page.getByLabel("Teléfono").fill("099 123 456");
  // Hay dos edificios ficticios: el de las pruebas es el principal.
  await page.getByLabel("Tu edificio").selectOption("edificio-principal");
  await page.getByLabel("Tu unidad").fill(datos.codigo);
  await page.getByLabel(datos.calidad, { exact: true }).check();
  await page.getByLabel(/Acepto que la Administración/).check();
  await page.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(main(page).getByRole("status")).toContainText("Recibimos tu pedido");
}

test("sin aceptar ni completar, el pedido no se manda", async ({ page }) => {
  await page.goto("/pedir-acceso");
  await page.getByRole("button", { name: "Pedir acceso" }).click();
  await expect(main(page).getByRole("alert")).toContainText("Revisá los datos marcados");
  await expect(main(page)).toContainText("Necesitamos tu permiso para usar estos datos.");
  await page.getByLabel("Tu unidad").fill("99-999");
});

test("pedido de acceso: la Administración lo revisa, aprueba uno y rechaza otro", async ({ browser }, info) => {
  const u = await unidad(false, info.project.name === "movil" ? 16 : 17);
  const codigo = `${u.torre}-${u.numero}`;
  const marca = `${info.project.name}-${Date.now() % 100000}`;

  // 1. El dueño ya cargado pide acceso (aprobar no cambia la unidad: ya tiene usuario).
  const anonimo = await (await browser.newContext()).newPage();
  await pedir(anonimo, { nombre: `Dueño Prueba ${marca}`, email: u.duenoEmail, codigo, calidad: "Propietario" });
  // 2. Alguien que no comprobamos pide como inquilino.
  const otro = `pide.${marca}@example.com`;
  await pedir(anonimo, { nombre: `Otra Persona ${marca}`, email: otro, codigo, calidad: "Inquilino" });

  expect((await ultimoMailPara(ADMIN, `Pedido de acceso: unidad ${codigo}`)).texto).toContain("Comprobá que sea de esa unidad");

  // 3. La Administración lo ve en el inicio y en Datos.
  const admin = await (await browser.newContext()).newPage();
  await ingresar(admin, ADMIN);
  await expect(main(admin)).toContainText(/pedidos? de acceso para revisar/);
  await admin.goto("/datos/accesos");

  const pedido1 = main(admin).getByRole("article", { name: `Pedido de Dueño Prueba ${marca}` });
  await pedido1.getByRole("button", { name: "Aprobar" }).click();
  await expect(pedido1).toContainText("Ya figura en la unidad");
  await pedido1.getByRole("button", { name: "Sí, aprobar" }).click();
  await expect(main(admin).getByRole("status").filter({ hasText: "Aprobaste el pedido" })).toBeVisible();

  await admin.reload();
  const pedido2 = main(admin).getByRole("article", { name: `Pedido de Otra Persona ${marca}` });
  await pedido2.getByRole("button", { name: "Rechazar" }).click();
  await pedido2.getByLabel("Motivo (opcional)").fill("No figura en nuestros registros");
  await pedido2.getByRole("button", { name: "Rechazar el pedido" }).click();
  await expect(main(admin).getByRole("status").filter({ hasText: "Rechazaste el pedido" })).toBeVisible();
  expect((await ultimoMailPara(otro, "Tu pedido de acceso al sistema del edificio")).texto).toContain("No figura en nuestros registros");
});

test("Portería y las unidades no ven los pedidos de acceso", async ({ page }) => {
  await ingresar(page, "porteria@example.com");
  await page.goto("/datos/accesos");
  await expect(page.getByRole("heading", { level: 1, name: "Pedidos de acceso" })).toHaveCount(0);
});
