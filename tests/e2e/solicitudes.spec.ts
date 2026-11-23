import { expect, test, type Page } from "@playwright/test";
import { unidad } from "./db";
import { ADMIN, ingresar, ultimoMailPara } from "./utiles";

const main = (page: Page) => page.getByRole("main");
const exito = (page: Page, texto: string | RegExp) => main(page).getByRole("status").filter({ hasText: texto });
const proyecto = (nombre: string) => (nombre === "movil" ? 0 : 1);
// PNG de 1×1 (se achica y se convierte a JPEG en el navegador antes de subir).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("la unidad avisa un desperfecto, la Administración responde y nadie más lo ve", async ({ page }, info) => {
  const p = proyecto(info.project.name);
  const u = await unidad(false, 20 + p);
  const otra = await unidad(false, 22 + p);
  const codigo = `${u.torre}-${u.numero}`;
  const asunto = `Pierde agua el calefón (${info.project.name})`;

  await ingresar(page, u.duenoEmail);
  await page.getByRole("link", { name: /Solicitudes varias/ }).click();
  await expect(main(page).getByRole("navigation").getByRole("link")).toHaveText(["Aviso de desperfectos", "Consultas de gastos comunes", "Inquietudes varias"]);
  await expect(main(page).getByRole("link", { name: /Bandeja de solicitudes/ })).toHaveCount(0);
  await main(page).getByRole("link", { name: "Aviso de desperfectos" }).click();
  await expect(main(page)).toContainText(`Va a nombre de la unidad ${codigo}`);

  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Completá el asunto.");
  await expect(main(page)).toContainText("Contá qué pasa.");
  await main(page).getByLabel("Asunto").fill(asunto);
  await main(page).getByLabel("Contá qué pasa").fill("Gotea desde anoche en la cocina.");
  // Un archivo que no es imagen se rechaza.
  await main(page).getByLabel("Foto (opcional)").setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("no soy una foto") });
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("La foto tiene que ser JPG, PNG o WebP.");
  await main(page).getByLabel("Foto (opcional)").setInputFiles({ name: "canilla.png", mimeType: "image/png", buffer: PNG });
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Enviaste la solicitud");
  // Botón de WhatsApp con el mensaje armado (categoría + unidad + asunto), sin integración.
  const wa = await main(page).getByRole("link", { name: "Escribir por WhatsApp" }).getAttribute("href");
  expect(wa).toContain("https://wa.me/59899000000?text=");
  expect(decodeURIComponent(wa!.split("text=")[1])).toBe(`Desperfecto · Unidad ${codigo} · ${asunto}`);
  expect((await ultimoMailPara(ADMIN, `Desperfecto: ${asunto}`)).texto).toContain(`unidad ${codigo}`);
  await page.reload();
  const mia = main(page).getByRole("region", { name: "Mis solicitudes" }).getByRole("link", { name: new RegExp(asunto.replace(/[()]/g, "\\$&")) });
  await expect(mia).toContainText("Nueva");
  const url = await mia.getAttribute("href");

  // Administración la encuentra en la bandeja, responde y deja una nota interna.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, ADMIN);
  await page.goto("/solicitudes");
  await main(page).getByRole("link", { name: /Bandeja de solicitudes \(\d+ nuevas?\)/ }).click();
  await main(page).getByRole("navigation", { name: "Filtrar por categoría" }).getByRole("link", { name: "Desperfecto" }).click();
  await expect(page).toHaveURL(/categoria=DESPERFECTO$/);
  await main(page).getByRole("navigation", { name: "Filtrar por estado" }).getByRole("link", { name: "Nueva" }).click();
  await expect(page).toHaveURL(/categoria=DESPERFECTO/);
  await main(page).getByRole("link", { name: new RegExp(asunto.replace(/[()]/g, "\\$&")) }).click();
  await expect(main(page)).toContainText("Gotea desde anoche");
  const foto = main(page).getByRole("img", { name: `Foto adjunta: ${asunto}` });
  await expect(foto).toBeVisible();
  const urlFoto = new URL((await foto.getAttribute("src"))!, page.url()).toString();
  const r = await page.request.get(urlFoto);
  expect(r.headers()["content-type"]).toBe("image/jpeg");
  await main(page).getByLabel("Respuesta").fill("Mañana a las 10 pasa el sanitario.");
  await main(page).getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(exito(page, "Respondiste la solicitud")).toBeVisible();
  await main(page).getByLabel("Nota interna").fill("Avisar al sanitario de prueba.");
  await main(page).getByRole("button", { name: "Guardar nota" }).click();
  await expect(exito(page, "Guardaste la nota interna")).toBeVisible();
  await expect(main(page)).toContainText("Pasó de nueva a en curso.");

  const mail = await ultimoMailPara(u.duenoEmail, `Respuesta a tu solicitud: ${asunto}`);
  expect(mail.texto).toContain("Mañana a las 10 pasa el sanitario.");

  // La unidad ve la respuesta, no la nota interna.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.duenoEmail);
  await page.goto(url!);
  await expect(main(page)).toContainText("Respuesta de la Administración");
  await expect(main(page)).toContainText("Mañana a las 10 pasa el sanitario.");
  await expect(main(page)).toContainText("En curso");
  await expect(main(page)).not.toContainText("Avisar al sanitario");

  // Otra unidad no la ve ni puede abrirla.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, otra.duenoEmail);
  await page.goto("/solicitudes/desperfectos");
  await expect(main(page)).not.toContainText(asunto);
  await page.goto(url!);
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
  expect((await page.request.get(`${url!.replace("/solicitudes/ver/", "/api/solicitudes/")}/foto`)).status()).toBe(404);
  await page.goto("/solicitudes/bandeja");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});

test("Portería hace una solicitud a pedido de una unidad y otra por sí misma", async ({ page }, info) => {
  const p = proyecto(info.project.name);
  // Unidad alquilada: la pide el propietario (las no alquiladas las usan otros tests).
  const u = await unidad(true, 6 + p);
  const codigo = `${u.torre}-${u.numero}`;
  const asunto = `Ruidos molestos de noche (${info.project.name})`;

  await ingresar(page, "porteria@example.com");
  await page.goto("/solicitudes/inquietudes");
  await main(page).getByLabel("Asunto").fill(asunto);
  await main(page).getByLabel("Contá qué pasa").fill("Me pidió que lo anote porque no usa el sistema.");
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Elegí si es por vos o a pedido de una unidad.");
  await main(page).getByLabel("A pedido de una unidad").check();
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Escribí el código de la unidad");
  await expect(main(page).getByLabel("Asunto")).toHaveValue(asunto);
  await main(page).getByLabel("Unidad", { exact: true }).fill(codigo);
  await main(page).getByLabel("Quién lo pidió").fill("Vecina De Prueba");
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Enviaste la solicitud");
  await main(page).getByRole("button", { name: "Hacer otra solicitud" }).click();

  // Por sí misma.
  await main(page).getByLabel("Por mí (Portería)").check();
  await main(page).getByLabel("Asunto").fill(`Falta lamparita en el hall (${info.project.name})`);
  await main(page).getByLabel("Contá qué pasa").fill("La del hall de entrada.");
  await main(page).getByRole("button", { name: "Enviar a la Administración" }).click();
  await expect(main(page)).toContainText("Enviaste la solicitud");
  await page.reload();
  const mias = main(page).getByRole("region", { name: "Mis solicitudes" });
  await expect(mias).toContainText(asunto);
  await expect(mias).toContainText(`${codigo}, Portería a pedido (pidió Vecina De Prueba)`);

  // La unidad la ve entre las suyas.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.duenoEmail);
  await page.goto("/solicitudes/inquietudes");
  await expect(main(page).getByRole("region", { name: "Mis solicitudes" })).toContainText(asunto);
});

test("la Comisión lee la bandeja pero no gestiona", async ({ page }) => {
  await ingresar(page, "comision@example.com");
  await page.goto("/solicitudes/desperfectos");
  await expect(page).toHaveURL(/\/solicitudes\/bandeja\?categoria=DESPERFECTO$/);
  await main(page).getByRole("link", { name: /No funciona la luz del palier/ }).click();
  await expect(main(page)).toContainText("Gracias por avisar");
  await expect(main(page)).not.toContainText("Pedido al electricista");
  await expect(main(page).getByRole("button", { name: "Enviar respuesta" })).toHaveCount(0);
});
