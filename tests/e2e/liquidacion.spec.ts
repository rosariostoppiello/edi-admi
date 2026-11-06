import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";

const main = (page: Page) => page.getByRole("main");
const exito = (page: Page, texto: string | RegExp) => main(page).getByRole("status").filter({ hasText: texto });

async function planilla(filas: (string | number | Date)[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Pagos");
  hoja.addRow(["Fecha", "Unidad", "Monto", "Referencia"]);
  for (const f of filas) hoja.addRow(f);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

async function subir(page: Page, nombre: string, contenido: Buffer) {
  await main(page)
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: nombre, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: contenido });
  await main(page).getByRole("button", { name: "Ver vista previa" }).first().click();
}

async function publicar(page: Page) {
  await page.getByRole("link", { name: /Revisar y publicar/ }).click();
  await main(page).getByRole("button", { name: "Publicar liquidación" }).click();
  await expect(main(page)).toContainText("mandarla por mail a");
  await main(page).getByRole("button", { name: "Sí, publicar y enviar" }).click();
  await expect(page).toHaveURL(/\/liquidaciones\/2026-10\?publicada=1$/);
}

// La confección es de Administración (escritorio). Los dos tests van en orden:
// publicar octubre y después anularlo y publicar la corrección.
test.describe.serial("confección, publicación y anulación (Administración)", () => {
  test("prepara octubre, importa pagos con vista previa, carga un egreso y publica con envío por mail", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
    const u = await unidad(false, 6);
    const codigo = `${u.torre}-${u.numero}-A`;

    await ingresar(page, ADMIN);
    await page.goto("/liquidaciones");
    await main(page).getByRole("link", { name: "Preparar octubre" }).click();
    await main(page).getByRole("button", { name: "Crear borrador" }).click();
    await expect(page).toHaveURL(/\/confeccion\/[^/]+\/ingresos$/);
    await expect(page.getByRole("heading", { name: "Liquidación de octubre 2026" })).toBeVisible();

    // Planilla con un error: se ve en la vista previa y no se puede confirmar.
    await subir(page, "con-error.xlsx", await planilla([["05/10/2026", "2-999-A", 100, "x"], ["05/10/2026", codigo, 1500, "T1"]]));
    await expect(main(page)).toContainText("La unidad 2-999 no existe.");
    await expect(main(page).getByRole("button", { name: /^Cargar \d+ pagos?$/ })).toHaveCount(0);
    await main(page).getByRole("button", { name: "Descartar planilla" }).click();
    await expect(exito(page, "Descartaste la planilla")).toBeVisible();

    // Planilla correcta: se confirma y se cargan los pagos.
    await subir(page, "pagos.xlsx", await planilla([[new Date(Date.UTC(2026, 9, 5)), codigo, "1.500,00", "T1"]]));
    await expect(main(page)).toContainText("Todas las filas están bien");
    await main(page).getByRole("button", { name: "Cargar 1 pago" }).click();
    await expect(exito(page, "Cargaste 1 pago por $U 1.500,00")).toBeVisible();
    await expect(main(page).getByRole("heading", { name: "Pagos cargados (1)" })).toBeVisible();

    // Pago manual, con un monto mal escrito primero (no se pierde lo cargado).
    const pago = main(page).locator("form").filter({ has: page.getByRole("button", { name: "Cargar pago" }) });
    await pago.getByLabel("Unidad").fill(codigo);
    await pago.getByLabel("Monto").fill("mil");
    await pago.getByRole("button", { name: "Cargar pago" }).click();
    await expect(pago).toContainText("Escribilo como 1.234,50");
    await expect(pago.getByLabel("Unidad")).toHaveValue(codigo);
    await pago.getByLabel("Monto").fill("250,50");
    await pago.getByRole("button", { name: "Cargar pago" }).click();
    await expect(exito(page, `Cargaste $U 250,50 a ${codigo}`)).toBeVisible();

    // Egreso variable (los fijos ya vienen precargados).
    await page.getByRole("link", { name: /Egresos/ }).click();
    await expect(main(page).getByRole("heading", { name: /Egresos del mes \(6\)/ })).toBeVisible();
    const egreso = main(page).locator("form").filter({ has: page.getByRole("button", { name: "Cargar egreso" }) });
    await egreso.getByLabel("Rubro").selectOption({ label: "3.3 Sanitaria" });
    await egreso.getByLabel("Proveedor o ente").fill("Sanitaria de Prueba");
    await egreso.getByLabel("Monto").fill("4.000");
    await egreso.getByRole("button", { name: "Cargar egreso" }).click();
    await expect(exito(page, "Cargaste el egreso.")).toBeVisible();

    await publicar(page);
    await expect(main(page)).toContainText(/\d+ enviados/);

    // Le llega el mail con su saldo y el PDF adjunto.
    const mail = await ultimoMailPara(u.duenoEmail);
    expect(mail.asunto).toBe("Liquidación de gastos comunes de octubre 2026");
    expect(mail.texto).toContain(`${codigo}: saldo a pagar $U`);
    expect(mail.adjuntos?.[0].nombre).toBe("liquidacion-gastos-comunes-2026-10.pdf");

    // La unidad ve su recibo con los pagos y descarga el PDF.
    const ctx = await browser.newContext();
    const vecino = await ctx.newPage();
    await ingresar(vecino, u.duenoEmail);
    await vecino.goto("/liquidaciones");
    await vecino.getByRole("link", { name: "Ver tu liquidación de octubre" }).click();
    const recibo = vecino.getByRole("article", { name: `Cuenta de ${codigo}` });
    await expect(recibo).toContainText("Pagos recibidos");
    await expect(recibo).toContainText("-1.750,50");
    // Ley 18.331: la unidad no ve el consolidado de las demás.
    await expect(main(vecino).getByRole("heading", { name: "Detalle por unidad" })).toHaveCount(0);
    const href = await main(vecino).getByRole("link", { name: /Ver la liquidación completa/ }).getAttribute("href");
    const pdf = await vecino.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await ctx.close();
  });

  test("anula octubre con motivo, corrige y publica la rectificada", async ({ page }, info) => {
    test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
    const u = await unidad(false, 6);
    await ingresar(page, ADMIN);
    await page.goto("/liquidaciones/2026-10");
    await main(page).getByRole("button", { name: "Anular y corregir" }).click();
    await main(page).getByLabel("Motivo de la anulación").fill("error");
    await main(page).getByRole("button", { name: "Sí, anular y corregir" }).click();
    await expect(main(page)).toContainText("Contá el motivo con un poco más de detalle.");
    await main(page).getByLabel("Motivo de la anulación").fill("Faltó cargar un pago de la planilla del banco");
    await main(page).getByRole("button", { name: "Sí, anular y corregir" }).click();
    await expect(page).toHaveURL(/\/revision\?rectificacion=1$/);
    await expect(page.getByRole("heading", { name: "Corrección de la liquidación de octubre 2026" })).toBeVisible();

    // La copia trae los pagos de la anulada.
    await page.getByRole("link", { name: /Ingresos/ }).click();
    await expect(main(page).getByRole("heading", { name: "Pagos cargados (2)" })).toBeVisible();

    await publicar(page);
    expect((await ultimoMailPara(u.duenoEmail)).asunto).toBe("Liquidación rectificada de gastos comunes de octubre 2026");

    // Administración ve la anulada en el historial, con su motivo.
    await page.goto("/liquidaciones");
    await expect(main(page).getByText("Anulada")).toBeVisible();
    await main(page).getByRole("link", { name: "Octubre 2026" }).last().click();
    await expect(main(page)).toContainText("Motivo: Faltó cargar un pago");
  });
});

test("el responsable ve el recibo de sus líneas e inquilino solo la suya", async ({ page }, info) => {
  const n = info.project.name === "movil" ? 3 : 4;
  const u = await unidad(true, n);
  const base = `${u.torre}-${u.numero}`;

  await ingresar(page, u.duenoEmail);
  await page.goto("/liquidaciones/2026-09");
  await expect(page.getByRole("article", { name: `Cuenta de ${base}-P` })).toBeVisible();
  await expect(page.getByRole("article", { name: `Cuenta de ${base}-I` })).toBeVisible();
  // Mobile-first: el recibo no se sale de la pantalla.
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ancho).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.inquilinoEmail!);
  await page.goto("/liquidaciones/2026-09");
  await expect(page.getByRole("article", { name: `Cuenta de ${base}-I` })).toBeVisible();
  await expect(page.getByRole("article", { name: `Cuenta de ${base}-P` })).toHaveCount(0);
});

test("la confección es solo de Administración; Portería y Comisión ven lo suyo", async ({ page }) => {
  const u = await unidad(false, 7);
  await ingresar(page, u.duenoEmail);
  await page.goto("/liquidaciones/confeccion");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await page.goto("/liquidaciones");
  await expect(main(page).getByText("Confección")).toHaveCount(0);
  await page.getByRole("button", { name: "Salir" }).click();

  await ingresar(page, "porteria@example.com");
  await page.goto("/liquidaciones/2026-09");
  await expect(main(page).getByRole("link", { name: /Ver la liquidación completa/ })).toBeVisible();
  await expect(main(page).getByRole("heading", { name: "Detalle por unidad" })).toHaveCount(0);
  await page.getByRole("button", { name: "Salir" }).click();

  await ingresar(page, "comision@example.com");
  await page.goto("/liquidaciones/2026-09");
  await expect(main(page).getByRole("heading", { name: "Detalle por unidad" })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Anular y corregir" })).toHaveCount(0);
});
