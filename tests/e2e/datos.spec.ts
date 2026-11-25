import { expect, test, type Page } from "@playwright/test";
import { idDeUnidadAjena, unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";

const main = (page: Page) => page.getByRole("main");
const proyecto = (nombre: string) => (nombre === "movil" ? 0 : 1);

test("alta y baja de inquilino: A → P+I → A, con invitación por mail", async ({ page, browser }, info) => {
  const u = await unidad(false, proyecto(info.project.name));
  const codigo = `${u.torre}-${u.numero}`;
  const inquilinoEmail = `inquilino.${info.project.name}.${Date.now()}@example.com`;

  // 1. El propietario carga al inquilino.
  await ingresar(page, u.duenoEmail);
  await page.goto("/datos/editar");
  await expect(main(page)).toContainText(`figura como ${codigo}-A`);
  await main(page).getByRole("button", { name: /cargar al inquilino|Cargar inquilino/ }).click();
  const form = main(page).locator("form").filter({ has: page.getByRole("button", { name: "Cargar inquilino" }) });
  await form.getByLabel("Nombre y apellido").fill("Inquilina De Prueba");
  await form.getByLabel("Teléfono").fill("098 765 432");
  await form.getByLabel("Mail").fill(inquilinoEmail);
  await form.getByRole("button", { name: "Cargar inquilino" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Inquilino cargado" })).toBeVisible();
  await page.reload();
  await expect(main(page)).toContainText(`figura como ${codigo}-P (propietario) y ${codigo}-I (inquilino)`);

  // 2. La inquilina recibe la invitación, crea su contraseña y entra.
  const mail = await ultimoMailPara(inquilinoEmail);
  expect(mail.asunto).toBe("Tu acceso al sistema de gastos comunes");
  const enlace = mail.texto.match(/https?:\/\/\S+/)![0];
  const ctxInq = await browser.newContext();
  const inq = await ctxInq.newPage();
  await inq.goto(enlace);
  await expect(inq.getByRole("heading", { name: "Creá tu contraseña" })).toBeVisible();
  await inq.getByLabel("Contraseña nueva", { exact: true }).fill("Clave-inquilina-2026");
  await inq.getByLabel("Repetí la contraseña", { exact: true }).fill("Clave-inquilina-2026");
  await inq.getByRole("button", { name: "Guardar contraseña" }).click();
  await ingresar(inq, inquilinoEmail, "Clave-inquilina-2026");
  await expect(inq.getByRole("banner")).toContainText(`${codigo}-I`);

  // Ley 18.331: la inquilina ve solo sus datos, no el mail ni el teléfono del dueño.
  await inq.goto("/datos");
  await expect(inq.getByRole("heading", { name: "Tus datos" })).toBeVisible();
  await expect(main(inq)).not.toContainText(u.duenoEmail);

  // 3. El propietario la da de baja (con confirmación).
  await page.reload();
  await main(page).getByRole("button", { name: "Dar de baja al inquilino" }).click();
  await expect(main(page)).toContainText("vuelve a figurar con código A");
  await main(page).getByRole("button", { name: "Sí, dar de baja" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Inquilino dado de baja" })).toBeVisible();
  await page.reload();
  await expect(main(page)).toContainText(`figura como ${codigo}-A`);

  // La inquilina perdió el acceso: su sesión se cerró y no puede volver a entrar.
  await inq.goto("/inicio");
  await expect(inq).toHaveURL(/\/ingresar$/);
  await ingresar(inq, inquilinoEmail, "Clave-inquilina-2026");
  await expect(main(inq).getByRole("alert")).toBeVisible();
  await ctxInq.close();
});

test("el inquilino se da de baja solo y pierde el acceso", async ({ page }, info) => {
  // n ≥ 1: la primera unidad alquilada la usan los tests de contraseña.
  const u = await unidad(true, 1 + proyecto(info.project.name));
  await ingresar(page, u.inquilinoEmail!);
  await page.goto("/datos/editar");
  await main(page).getByRole("button", { name: "Darme de baja como inquilino" }).click();
  await main(page).getByRole("button", { name: "Sí, darme de baja" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);

  // El dueño ve la unidad otra vez con código A.
  await ingresar(page, u.duenoEmail);
  await page.goto("/datos");
  await expect(main(page)).toContainText(`figura como ${u.torre}-${u.numero}-A`);
});

test("los datos del responsable no pueden quedar vacíos", async ({ page }, info) => {
  const u = await unidad(false, 2 + proyecto(info.project.name));
  await ingresar(page, u.duenoEmail);
  await page.goto("/datos/editar");
  await main(page).getByRole("button", { name: "Editar mis datos" }).click();
  await main(page).getByLabel("Teléfono").fill("");
  await main(page).getByLabel("Nombre y apellido").fill("   ");
  await main(page).getByRole("button", { name: "Guardar cambios" }).click();
  await expect(main(page)).toContainText("Completá el teléfono.");
  await expect(main(page)).toContainText("Completá el nombre.");

  await main(page).getByLabel("Nombre y apellido").fill("Nombre Corregido");
  await main(page).getByLabel("Teléfono").fill("099 111 222");
  await main(page).getByRole("button", { name: "Guardar cambios" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Datos guardados" })).toBeVisible();
});

test("una unidad no puede ver la ficha de otra", async ({ page }, info) => {
  const u = await unidad(false, 4 + proyecto(info.project.name));
  const ajena = await idDeUnidadAjena(u.unidadId);
  await ingresar(page, u.duenoEmail);
  await page.goto(`/datos/${ajena}`);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  await page.goto("/datos/unidades");
  await expect(page).toHaveURL(/\/datos$/);
});

for (const [rol, email] of [
  ["Portería", "porteria@example.com"],
  ["La Comisión sin unidad", "comision@example.com"],
] as const) {
  test(`${rol} ve código y ocupante, sin mails ni teléfonos`, async ({ page }) => {
    await ingresar(page, email);
    await page.goto("/datos");
    await expect(page).toHaveURL(/\/datos\/unidades$/);
    await expect(main(page).getByRole("listitem").first()).toBeVisible();
    await expect(main(page)).not.toContainText("@example.com");
    await expect(main(page)).not.toContainText(/09\d{7}/);
    // No tiene enlaces a las fichas ni puede abrirlas.
    const u = await unidad(false, 0);
    await page.goto(`/datos/${u.unidadId}`);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  });
}

test("la unidad ve sus datos, entra a Editar y avisa la venta a la Administración", async ({ page }, info) => {
  const u = await unidad(false, 8 + proyecto(info.project.name));
  const codigo = `${u.torre}-${u.numero}`;
  await ingresar(page, u.duenoEmail);
  await page.getByRole("link", { name: /Datos de propietarios e inquilinos/ }).click();
  await expect(page).toHaveURL(/\/datos$/);
  // Solo lectura: los formularios están detrás de la tecla Editar.
  await expect(main(page)).toContainText(u.duenoEmail);
  await expect(main(page).getByRole("button", { name: "Editar mis datos" })).toHaveCount(0);
  await main(page).getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(/\/datos\/editar$/);
  await expect(main(page).getByRole("button", { name: "Editar mis datos" })).toBeVisible();

  await page.getByRole("link", { name: "Mis datos" }).click();
  await main(page).getByRole("button", { name: "Avisar venta de la unidad" }).click();
  await main(page).getByLabel(/Comentario para la Administración/).fill("Firmamos la compraventa la semana pasada");
  await main(page).getByRole("button", { name: "Avisar a la Administración" }).click();
  await expect(main(page)).toContainText("Avisaste la venta");
  const mail = await ultimoMailPara(ADMIN, `Aviso de venta de la unidad ${codigo}`);
  expect(mail.texto).toContain("Firmamos la compraventa");

  // Administración lo ve en la ficha de la unidad.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, ADMIN);
  await page.goto(`/datos/${u.unidadId}`);
  await expect(main(page)).toContainText("avisó el");
  await expect(main(page)).toContainText("Firmamos la compraventa");
});

test("Administración crea una unidad con su responsable y le llega la invitación", async ({ page }, info) => {
  const numero = info.project.name === "movil" ? "901" : "902";
  const email = `nuevo.${numero}.${Date.now()}@example.com`;
  await ingresar(page, ADMIN);
  await page.goto("/datos/unidades");
  await page.getByRole("link", { name: "Nueva unidad" }).click();
  await expect(page.getByRole("heading", { name: "Nueva unidad" })).toBeVisible();
  await page.getByLabel("Torre", { exact: true }).selectOption("2");
  await page.getByLabel("Número").fill(numero);
  await page.getByLabel("Nombre y apellido").fill("Responsable Nuevo");
  await page.getByLabel("Teléfono").fill("099 000 111");
  await page.getByLabel("Mail").fill(email);
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(main(page).getByRole("status").filter({ hasText: "Unidad creada" })).toBeVisible();
  await expect(main(page)).toContainText(`2-${numero}-A`);
  expect((await ultimoMailPara(email)).asunto).toBe("Tu acceso al sistema de gastos comunes");

  // No se puede repetir el número en la misma torre.
  await page.goto("/datos/nueva");
  await page.getByLabel("Torre", { exact: true }).selectOption("2");
  await page.getByLabel("Número").fill(numero);
  await page.getByLabel("Nombre y apellido").fill("Otro");
  await page.getByLabel("Teléfono").fill("099 000 222");
  await page.getByLabel("Mail").fill(`otro.${email}`);
  await page.getByRole("button", { name: "Crear unidad" }).click();
  await expect(main(page)).toContainText(`Ya existe la unidad 2-${numero}.`);
});

