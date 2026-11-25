import { expect, test, type Page } from "@playwright/test";
import { reservasActivas, unidad } from "./db";
import { ADMIN, ingresar } from "./utiles";
import { fechaEnFrase, fechaUy, sumarDias } from "../../src/dominio/reservas";

const main = (page: Page) => page.getByRole("main");
const exito = (page: Page, texto: string | RegExp) => main(page).getByRole("status").filter({ hasText: texto });
const proyecto = (nombre: string) => (nombre === "movil" ? 0 : 1);
const hoy = () => fechaUy(new Date());
/** La lista de reservas ("Tus reservas" o "Próximas reservas"), no las tarjetas del calendario. */
const lista = (page: Page) => main(page).getByRole("region", { name: /Tus reservas|Próximas reservas/ }).getByRole("listitem");

test("la unidad reserva un turno libre, las demás lo ven ocupado sin saber de quién, y lo cancela", async ({ page }, info) => {
  const p = proyecto(info.project.name);
  const u = await unidad(false, 10 + p);
  const otra = await unidad(false, 12 + p);
  const fecha = sumarDias(hoy(), 30 + p);
  const turno = `Barbacoa Torre B, ${fechaEnFrase(fecha)}, noche`;

  await ingresar(page, u.duenoEmail);
  await page.getByRole("link", { name: /Reserva de espacios comunes/ }).click();
  await expect(main(page).getByRole("navigation").getByRole("link")).toHaveText(["Barbacoas", "Solarium", "Laundry"]);
  await expect(main(page).getByRole("link", { name: /Configurar los espacios/ })).toHaveCount(0);
  await main(page).getByRole("link", { name: "Barbacoas" }).click();
  await expect(page.getByRole("heading", { name: "Barbacoas", exact: true })).toBeVisible();

  await page.goto(`/reservas/barbacoas?desde=${fecha}`);
  await main(page).getByRole("link", { name: `Reservar ${turno}` }).click();
  await expect(page.getByRole("heading", { name: "Reservar barbacoa" })).toBeVisible();
  await expect(main(page)).toContainText(`${u.torre}-${u.numero}-A`);
  await expect(main(page)).toContainText("$U 800,00");
  await expect(main(page)).toContainText("Podés cancelarla hasta el");
  await main(page).getByRole("button", { name: "Confirmar la reserva" }).click();
  await expect(page).toHaveURL(/reservada=1/);
  await expect(exito(page, "la reserva quedó hecha")).toBeVisible();
  await expect(main(page)).toContainText(`${turno}: tu reserva`);
  const mia = lista(page).filter({ hasText: "Torre B" }).filter({ hasText: fechaEnFrase(fecha).slice(1) });
  await expect(mia).toContainText("La reservó la unidad");
  // Mobile-first: sin scroll horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  // Otra unidad ve el turno ocupado, pero no de quién es (Ley 18.331).
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, otra.duenoEmail);
  await page.goto(`/reservas/barbacoas?desde=${fecha}`);
  await expect(main(page)).toContainText(`${turno}: ocupada`);
  await expect(main(page)).not.toContainText(`${u.torre}-${u.numero}`);
  await expect(main(page).getByRole("link", { name: `Reservar ${turno}` })).toHaveCount(0);

  // Quien reservó la cancela (faltan más de 48 h).
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.duenoEmail);
  await page.goto(`/reservas/barbacoas?desde=${fecha}`);
  await mia.getByRole("button", { name: "Cancelar la reserva" }).click();
  await mia.getByRole("button", { name: "Sí, cancelar la reserva" }).click();
  await expect(exito(page, "Cancelaste la reserva de Barbacoa Torre B")).toBeVisible();
  await page.reload();
  await expect(main(page).getByRole("link", { name: `Reservar ${turno}` })).toBeVisible();
});

test("Portería reserva a pedido de una unidad; dentro de las 48 h solo Administración la cancela", async ({ page }, info) => {
  const p = proyecto(info.project.name);
  const u = await unidad(false, 14 + p);
  const codigo = `${u.torre}-${u.numero}-A`;
  const barbacoa = p === 0 ? "Torre A" : "Torre C";
  const fecha = sumarDias(hoy(), 1);
  const turno = `Barbacoa ${barbacoa}, ${fechaEnFrase(fecha)}, mediodía`;

  await ingresar(page, "porteria@example.com");
  await page.goto(`/reservas/barbacoas?desde=${fecha}`);
  await main(page).getByRole("link", { name: `Reservar ${turno}` }).click();
  await expect(main(page)).toContainText("ya no se va a poder cancelar");
  await main(page).getByLabel("Unidad que reserva").fill(codigo);
  await main(page).getByRole("button", { name: "Confirmar la reserva" }).click();
  await expect(main(page)).toContainText("Anotá quién te pidió la reserva.");
  await main(page).getByLabel("Quién lo pidió").fill("Vecino De Prueba");
  await main(page).getByRole("button", { name: "Confirmar la reserva" }).click();
  await expect(page).toHaveURL(/reservada=1/);
  // Portería ve qué unidad reservó y quién lo pidió; no la puede cancelar porque faltan menos de 48 h.
  await expect(main(page)).toContainText(`${turno}: ocupada por ${codigo}`);
  const item = lista(page).filter({ hasText: codigo }).filter({ hasText: barbacoa });
  await expect(item).toContainText("La cargó Portería a pedido de Vecino De Prueba");
  await expect(item).toContainText("Solo la Administración puede cancelarla");
  await expect(item.getByRole("button", { name: "Cancelar la reserva" })).toHaveCount(0);

  // El solarium de esa barbacoa no está disponible en ese turno.
  await page.goto(`/reservas/solarium?desde=${fecha}`);
  await expect(main(page)).toContainText(`Solarium ${barbacoa}, ${fechaEnFrase(fecha)}, mediodía: no disponible`);
  await expect(main(page)).toContainText(`Solarium ${barbacoa}, ${fechaEnFrase(fecha)}, noche: disponible`);

  // La unidad la ve como suya.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.duenoEmail);
  await page.goto(`/reservas/barbacoas?desde=${fecha}`);
  await expect(main(page)).toContainText(`${turno}: tu reserva`);

  // Administración la cancela fuera de plazo.
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, ADMIN);
  await page.goto("/reservas/barbacoas");
  const deAdmin = lista(page).filter({ hasText: codigo }).filter({ hasText: barbacoa });
  await deAdmin.getByRole("button", { name: "Cancelar la reserva" }).click();
  await expect(deAdmin).toContainText("Faltan menos de 48 horas");
  await deAdmin.getByRole("button", { name: "Sí, cancelar la reserva" }).click();
  await expect(exito(page, `Cancelaste la reserva de Barbacoa ${barbacoa}`)).toBeVisible();
});

test("dos unidades confirman el mismo turno a la vez: queda una sola reserva", async ({ browser }, info) => {
  const p = proyecto(info.project.name);
  const fecha = sumarDias(hoy(), 40 + p);
  const turno = `Barbacoa Torre C, ${fechaEnFrase(fecha)}, mediodía`;
  const paginas: Page[] = [];
  for (const n of [16 + p * 2, 17 + p * 2]) {
    const u = await unidad(false, n);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ingresar(page, u.duenoEmail);
    await page.goto(`/reservas/barbacoas?desde=${fecha}`);
    await main(page).getByRole("link", { name: `Reservar ${turno}` }).click();
    await expect(main(page).getByRole("button", { name: "Confirmar la reserva" })).toBeVisible();
    paginas.push(page);
  }
  await Promise.all(paginas.map((pg) => main(pg).getByRole("button", { name: "Confirmar la reserva" }).click()));
  await expect
    .poll(async () => {
      const r = await Promise.all(
        paginas.map(async (pg) => (/reservada=1/.test(pg.url()) ? "ok" : (await main(pg).getByRole("alert").count()) > 0 ? "error" : "esperando")),
      );
      return r.sort().join(",");
    })
    .toBe("error,ok");
  const perdedora = paginas.find((pg) => !/reservada=1/.test(pg.url()))!;
  await expect(main(perdedora).getByRole("alert")).toContainText("Ese turno se acaba de reservar");
  expect(await reservasActivas("Barbacoa Torre C", fecha, "MEDIODIA")).toBe(1);
  for (const pg of paginas) await pg.context().close();
});

test("Administración configura la tarifa y el laundry; una unidad no entra a la configuración", async ({ page }, info) => {
  test.skip(info.project.name !== "escritorio", "Administración trabaja desde escritorio");
  await ingresar(page, ADMIN);
  await page.goto("/reservas");
  await main(page).getByRole("link", { name: "Configurar los espacios y las tarifas" }).click();
  const sky = main(page).locator("section").filter({ has: page.getByRole("heading", { name: "Barbacoa Torre B" }) });
  await sky.getByLabel("Tarifa por turno").fill("-5");
  await sky.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(sky).toContainText("La tarifa no puede ser negativa.");
  await sky.getByLabel("Tarifa por turno").fill("800,00");
  await sky.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(sky.getByRole("status")).toContainText("Guardaste Barbacoa Torre B.");

  const laundry = main(page).locator("section").filter({ has: page.getByRole("heading", { name: "Laundry" }) });
  await laundry.getByLabel("Cómo funciona (lo ven todos)").fill("La tarjeta prepaga se recarga en la Portería de lunes a sábado.");
  await laundry.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(laundry.getByRole("status")).toContainText("Guardaste Laundry.");

  const u = await unidad(false, 9);
  await page.getByRole("button", { name: "Salir" }).click();
  await ingresar(page, u.duenoEmail);
  await page.goto("/reservas/laundry");
  await expect(main(page)).toContainText("La tarjeta prepaga se recarga en la Portería de lunes a sábado.");
  await page.goto("/reservas/espacios");
  await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
});
