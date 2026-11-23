import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";

const main = (page: Page) => page.getByRole("main");
const exito = (page: Page, texto: string | RegExp) => main(page).getByRole("status").filter({ hasText: texto });
const titulos = (page: Page) => main(page).getByRole("article").getByRole("heading", { level: 2 });

test.describe.serial("comunicados (Administración publica, todos leen)", () => {
  test("publica un aviso con mail, queda arriba por fecha y se da de baja", async ({ page }, info) => {
    test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
    const u = await unidad(false, 3);
    await ingresar(page, ADMIN);
    await page.getByRole("link", { name: /Comunicados de la Administración/ }).click();
    await expect(main(page).getByRole("navigation").getByRole("link")).toHaveText(["Avisos importantes", "Reglamentos", "Actas de asambleas"]);
    await main(page).getByRole("link", { name: "Avisos importantes" }).click();

    await main(page).getByRole("button", { name: "Publicar un aviso" }).click();
    await expect(main(page).getByLabel("Enviar por mail a todos")).toBeChecked();
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(main(page)).toContainText("Completá el título.");
    await main(page).getByLabel("Título").fill("Cambio de horario de la Portería");
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(main(page)).toContainText("Escribí el texto o subí un PDF.");
    await main(page).getByLabel("Texto").fill("Desde el lunes, la Portería atiende de 7 a 23 h.");
    // Un archivo que no es PDF se rechaza aunque diga .pdf.
    await main(page).getByLabel("PDF (opcional)").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("no soy un pdf") });
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(main(page)).toContainText("El archivo no es un PDF.");
    await expect(main(page).getByLabel("Título")).toHaveValue("Cambio de horario de la Portería");
    await main(page).getByLabel("PDF (opcional)").setInputFiles([]);
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(exito(page, /Publicaste el aviso y lo mandaste por mail a \d+ destinatarios/)).toBeVisible();

    const mail = await ultimoMailPara(u.duenoEmail, "Aviso importante: Cambio de horario de la Portería");
    expect(mail.texto).toContain("de 7 a 23 h");

    // Lo último arriba.
    await expect(titulos(page).first()).toHaveText("Cambio de horario de la Portería");
    await expect(titulos(page).nth(1)).toHaveText("Corte de agua programado");
    await expect(main(page)).toContainText(/Enviado por mail a \d+/);

    // Uno con fecha vieja queda abajo, sin mail.
    await main(page).getByRole("button", { name: "Publicar un aviso" }).click();
    await main(page).getByLabel("Título").fill("Aviso viejo de prueba");
    await main(page).getByLabel("Fecha").fill("2025-01-15");
    await main(page).getByLabel("Texto").fill("Texto de prueba.");
    await main(page).getByLabel("Enviar por mail a todos").uncheck();
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(exito(page, "Publicaste el aviso.")).toBeVisible();
    await expect(titulos(page).last()).toHaveText("Aviso viejo de prueba");

    // Dar de baja.
    const viejo = main(page).getByRole("article", { name: "Aviso viejo de prueba" });
    await viejo.getByRole("button", { name: "Dar de baja" }).click();
    await viejo.getByRole("button", { name: "Sí, dar de baja" }).click();
    await expect(exito(page, 'Diste de baja "Aviso viejo de prueba"')).toBeVisible();
    await expect(main(page).getByRole("article", { name: "Aviso viejo de prueba" })).toHaveCount(0);
  });

  test("reordena los reglamentos y publica uno nuevo con PDF", async ({ page }, info) => {
    test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
    await ingresar(page, ADMIN);
    await page.goto("/comunicados/reglamentos");
    await expect(titulos(page)).toHaveText(["Reglamento de copropiedad", "Reglamento de barbacoas", "Reglamento interno"]);
    await main(page).getByRole("button", { name: "Subir Reglamento interno" }).click();
    await expect(titulos(page)).toHaveText(["Reglamento de copropiedad", "Reglamento interno", "Reglamento de barbacoas"]);

    await main(page).getByRole("button", { name: "Publicar un reglamento" }).click();
    await main(page).getByLabel("Título").fill("Reglamento de mascotas");
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(main(page)).toContainText("Subí el PDF del reglamento.");
    await main(page).getByLabel("PDF", { exact: true }).setInputFiles({ name: "mascotas.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
    await main(page).getByRole("button", { name: "Publicar", exact: true }).click();
    await expect(exito(page, "Publicaste el reglamento.")).toBeVisible();
    await expect(titulos(page).last()).toHaveText("Reglamento de mascotas");
  });
});

test("una unidad lee los reglamentos, baja el PDF y no puede publicar", async ({ page, browser }, info) => {
  const u = await unidad(true, info.project.name === "movil" ? 8 : 9);
  await ingresar(page, u.inquilinoEmail!);
  await page.goto("/comunicados/reglamentos");
  await expect(main(page).getByRole("button", { name: /Publicar/ })).toHaveCount(0);
  await expect(main(page).getByRole("button", { name: "Dar de baja" })).toHaveCount(0);
  const enlace = main(page).getByRole("article", { name: "Reglamento de copropiedad" }).getByRole("link", { name: /Ver el PDF/ });
  const href = await enlace.getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Sin sesión no se baja.
  const anonimo = await browser.newContext();
  const r = await anonimo.request.get(href!, { maxRedirects: 0 });
  expect(r.headers()["content-type"] ?? "").not.toContain("application/pdf");
  await anonimo.close();

  // Actas por fecha y el reglamento de barbacoas enlazado desde Barbacoas.
  await page.goto("/comunicados/actas");
  await expect(main(page)).toContainText("Asamblea ordinaria de abril 2026");
  await page.goto("/reservas/barbacoas");
  await expect(main(page).getByRole("link", { name: "Leer el reglamento de barbacoas" })).toBeVisible();
});
