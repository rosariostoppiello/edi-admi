import { expect, test } from "@playwright/test";
import { ADMIN, USUARIOS_RESET, VECINA, ingresar, ultimoMailPara } from "./utiles";

test("sin sesión, cualquier pantalla manda al login", async ({ page }) => {
  await page.goto("/liquidaciones");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByRole("heading", { name: "Ingresá con tu mail" })).toBeVisible();
});

test("contraseña incorrecta muestra un error claro", async ({ page }) => {
  await ingresar(page, VECINA, "esta-no-es-la-clave");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("no coinciden");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("la unidad ingresa, ve su placa y los 6 botones, y sale", async ({ page }) => {
  await ingresar(page, VECINA);
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
  await expect(page.getByRole("banner").locator("summary")).toContainText("2-101-A");

  const secciones = page.getByRole("navigation", { name: "Secciones" }).getByRole("link");
  await expect(secciones).toHaveCount(6);
  // En el orden de "Proyecto en gráfico" (C.0).
  const nombres = [
    "Liquidación de gastos comunes",
    "Reserva de espacios comunes",
    "Solicitudes varias",
    "Comunicados de la Administración",
    "Teléfonos y datos de interés",
    "Datos de propietarios e inquilinos",
  ];
  for (const [i, nombre] of nombres.entries()) await expect(secciones.nth(i)).toContainText(nombre);

  // Cada tecla tiene al menos 44 px de alto (área táctil).
  for (const caja of await secciones.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) {
    expect(caja).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("Administración ve su rol en la cabecera (no tiene unidad)", async ({ page }) => {
  await ingresar(page, ADMIN);
  await expect(page.getByRole("banner")).toContainText("Administración");
});

test("recuperar contraseña por mail y entrar con la nueva", async ({ page }, info) => {
  // Cada proyecto usa un usuario distinto para no pisarse.
  const email = USUARIOS_RESET[info.project.name as keyof typeof USUARIOS_RESET];
  const nueva = `Nueva-clave-${info.project.name}-2026`;

  await page.goto("/recuperar");
  await page.getByLabel("Mail").fill(email);
  await page.getByRole("button", { name: "Mandarme el enlace" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Si el mail está registrado");

  const mail = await ultimoMailPara(email);
  const enlace = mail.texto.match(/https?:\/\/\S+/)?.[0];
  expect(enlace).toBeTruthy();

  await page.goto(enlace!);
  await expect(page.getByRole("heading", { name: "Elegí tu contraseña nueva" })).toBeVisible();
  await page.getByLabel("Contraseña nueva", { exact: true }).fill(nueva);
  await page.getByLabel("Repetí la contraseña", { exact: true }).fill(nueva);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("cambiaste tu contraseña");

  // El enlace no se puede reusar.
  await page.goto(enlace!);
  await expect(page.getByRole("heading", { name: "El enlace ya no sirve" })).toBeVisible();

  await ingresar(page, email, nueva);
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
});

test("pedir recuperación de un mail inexistente responde igual (no revela usuarios)", async ({ page }) => {
  await page.goto("/recuperar");
  await page.getByLabel("Mail").fill("nadie@example.com");
  await page.getByRole("button", { name: "Mandarme el enlace" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("Si el mail está registrado");
});

test("el ojo muestra y oculta la contraseña mientras se escribe", async ({ page }) => {
  await page.goto("/ingresar");
  const clave = page.getByLabel("Contraseña", { exact: true });
  const ojo = page.getByRole("button", { name: /Mostrar lo escrito/ });
  await clave.fill("una-clave");
  await expect(clave).toHaveAttribute("type", "password");
  await ojo.click();
  await expect(clave).toHaveAttribute("type", "text");
  await expect(ojo).toHaveAttribute("aria-pressed", "true");
  await ojo.click();
  await expect(clave).toHaveAttribute("type", "password");
});
