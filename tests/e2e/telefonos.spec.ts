import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";
import { fechaUy, sumarDias } from "../../src/dominio/reservas";

const main = (page: Page) => page.getByRole("main");
const exito = (page: Page, texto: string | RegExp) => main(page).getByRole("status").filter({ hasText: texto });

test.describe.serial("teléfonos y datos de interés", () => {
  test("una unidad ve los datos, llama con un toque y no edita", async ({ page }, info) => {
    // Solo lee: puede compartir la unidad con otros tests.
    const u = await unidad(false, 9);
    await ingresar(page, u.duenoEmail);
    await page.getByRole("link", { name: /Teléfonos y datos de interés/ }).click();
    await expect(main(page).getByRole("navigation").getByRole("link")).toHaveText([
      "Administración",
      "Comisión administradora",
      "Portería",
      "Empresas",
      "Servicios públicos",
      "Seguro de incendio",
    ]);

    await main(page).getByRole("link", { name: "Administración" }).click();
    await expect(main(page)).toContainText("Lunes a viernes de 10 a 17 h");
    await expect(main(page).getByRole("link", { name: "Llamar al 099 000 001" })).toHaveAttribute("href", "tel:099000001");
    await expect(main(page).getByRole("button", { name: /Editar|Cargar/ })).toHaveCount(0);

    // Comisión: solo quienes dieron su consentimiento (Ley 18.331).
    await page.goto("/telefonos/comision");
    await expect(main(page)).toContainText("Integrante Uno");
    await expect(main(page)).toContainText("Integrante Dos");
    if (info.project.name === "movil") await expect(main(page)).not.toContainText("Integrante Tres");

    await page.goto("/telefonos/empresas");
    await expect(main(page).getByRole("article", { name: "Bombas de Prueba" }).getByRole("link")).toHaveCount(2);
    await page.goto("/telefonos/servicios");
    await expect(main(page).getByRole("article", { name: "OSE" })).toContainText("0000000002");

    // El seguro del seed vence en 20 días: aviso visible para todos.
    await page.goto("/telefonos/seguro");
    await expect(main(page).getByRole("alert")).toContainText("La póliza vence en 20 días");
    await expect(main(page)).toContainText("POL-000123");
    // Mobile-first: sin scroll horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test("Administración edita, registra un consentimiento y renueva el seguro", async ({ page }, info) => {
    test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
    await ingresar(page, ADMIN);
    // El inicio ya no muestra el aviso, pero igual le manda el mail a Administración (una vez por vigencia).
    await expect(main(page).getByRole("alert")).toHaveCount(0);
    expect((await ultimoMailPara(ADMIN, "El seguro de incendio vence en 20 días")).texto).toContain("POL-000123");

    await page.goto("/telefonos/administracion");
    await main(page).getByRole("button", { name: "Editar" }).click();
    await main(page).getByLabel("Mail").fill("no-es-un-mail");
    await main(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(main(page)).toContainText("Escribí un mail válido.");
    await main(page).getByLabel("Mail").fill("administracion@example.com");
    await main(page).getByLabel("Horario de atención").fill("Lunes a viernes de 9 a 18 h");
    await main(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(exito(page, "Guardaste los datos.")).toBeVisible();
    await expect(main(page)).toContainText("Lunes a viernes de 9 a 18 h");

    await page.goto("/telefonos/empresas");
    await main(page).getByRole("button", { name: "Agregar una empresa" }).click();
    await main(page).getByLabel("Empresa").fill("Jardinería de Prueba");
    await main(page).getByLabel("Rubro").fill("Jardinería");
    await main(page).getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(main(page)).toContainText("Completá el teléfono.");
    await main(page).getByLabel("Teléfono").fill("099 700 700");
    await main(page).getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(exito(page, "Agregaste a Jardinería de Prueba.")).toBeVisible();
    await expect(main(page).getByRole("article", { name: "Jardinería de Prueba" })).toBeVisible();

    // Consentimiento: Integrante Tres pasa a verse.
    await page.goto("/telefonos/comision");
    const tres = main(page).getByRole("article", { name: "Integrante Tres" });
    await expect(tres).toContainText("Sin consentimiento");
    await tres.getByRole("button", { name: "Editar" }).click();
    await tres.getByLabel(/Dio su consentimiento/).check();
    await tres.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(exito(page, "Guardaste los datos de Integrante Tres.")).toBeVisible();
    await expect(tres).toContainText("Consentimiento registrado el");

    // Renovación del seguro: el aviso desaparece.
    await page.goto("/telefonos/seguro");
    await main(page).getByRole("button", { name: "Cargar la renovación" }).click();
    const hoy = fechaUy(new Date());
    await main(page).getByLabel("Aseguradora").fill("Aseguradora de Prueba");
    await main(page).getByLabel("Número de póliza").fill("POL-000456");
    await main(page).getByLabel("Vigencia desde").fill(sumarDias(hoy, 20));
    await main(page).getByLabel("Vigencia hasta").fill(sumarDias(hoy, 10));
    await main(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(main(page)).toContainText("Tiene que ser posterior al inicio de la vigencia.");
    await main(page).getByLabel("Vigencia hasta").fill(sumarDias(hoy, 385));
    await main(page).getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(exito(page, "Guardaste los datos de la póliza.")).toBeVisible();
    await expect(main(page)).toContainText("POL-000456");
    await expect(main(page).getByRole("alert")).toHaveCount(0);
    await page.goto("/");
    await expect(main(page).getByRole("alert")).toHaveCount(0);
  });
});

test("con el consentimiento registrado, la unidad ve al integrante", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio", "Depende del test de Administración");
  const u = await unidad(false, 9);
  await ingresar(page, u.duenoEmail);
  await page.goto("/telefonos/comision");
  await expect(main(page)).toContainText("Integrante Tres");
});
