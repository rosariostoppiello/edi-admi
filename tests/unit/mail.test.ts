import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const enviados: unknown[] = [];
vi.mock("nodemailer", () => ({
  createTransport: (opciones: unknown) => ({ sendMail: async (m: unknown) => void enviados.push({ opciones, m }) }),
}));
const { enviarMail, esFicticio } = await import("@/servidor/mail");

describe("driver de mail Resend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("manda el mail con el adjunto en base64 a la API de Resend", async () => {
    vi.stubEnv("MAIL_DRIVER", "resend");
    vi.stubEnv("RESEND_API_KEY", "clave-de-prueba");
    vi.stubEnv("MAIL_FROM", "Administración <avisos@example.com>");
    const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    await enviarMail({ para: "vecina@prueba.test", asunto: "Hola", texto: "Texto", adjuntos: [{ nombre: "a.pdf", tipo: "application/pdf", contenido: Buffer.from("%PDF-") }] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer clave-de-prueba");
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo).toMatchObject({ from: "Administración <avisos@example.com>", to: ["vecina@prueba.test"], subject: "Hola", text: "Texto" });
    expect(cuerpo.attachments[0]).toEqual({ filename: "a.pdf", content: Buffer.from("%PDF-").toString("base64"), content_type: "application/pdf" });
  });

  it("si Resend rechaza, tira un error (el envío queda para reintentar)", async () => {
    vi.stubEnv("MAIL_DRIVER", "resend");
    vi.stubEnv("RESEND_API_KEY", "x");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("dominio no verificado", { status: 403 })));
    await expect(enviarMail({ para: "a@prueba.test", asunto: "a", texto: "a" })).rejects.toThrow(/403/);
  });

  it("sin clave no intenta mandar", async () => {
    vi.stubEnv("MAIL_DRIVER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(enviarMail({ para: "a@prueba.test", asunto: "a", texto: "a" })).rejects.toThrow(/RESEND_API_KEY/);
  });
});

describe("driver SMTP (Gmail)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("manda desde la cuenta de Gmail con el nombre de MAIL_FROM y los adjuntos", async () => {
    vi.stubEnv("MAIL_DRIVER", "smtp");
    vi.stubEnv("SMTP_USER", "administracion.prueba@gmail.com");
    vi.stubEnv("SMTP_PASS", "clave-de-aplicacion");
    vi.stubEnv("MAIL_FROM", "Administración del Complejo <x@y.com>");
    await enviarMail({ para: "vecina@prueba.test", asunto: "Hola", texto: "Texto", adjuntos: [{ nombre: "a.pdf", tipo: "application/pdf", contenido: Buffer.from("%PDF-") }] });
    const { opciones, m } = enviados.at(-1) as { opciones: Record<string, unknown>; m: Record<string, unknown> };
    expect(opciones).toMatchObject({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "administracion.prueba@gmail.com", pass: "clave-de-aplicacion" } });
    expect(m).toMatchObject({ from: { name: "Administración del Complejo", address: "administracion.prueba@gmail.com" }, to: "vecina@prueba.test", subject: "Hola" });
  });

  it("no manda a los mails ficticios del seed (example.com)", async () => {
    vi.stubEnv("MAIL_DRIVER", "smtp");
    vi.stubEnv("SMTP_USER", "a@gmail.com");
    vi.stubEnv("SMTP_PASS", "x");
    const antes = enviados.length;
    await enviarMail({ para: "laura.pereira.1@example.com", asunto: "a", texto: "a" });
    expect(enviados.length).toBe(antes);
    expect(esFicticio("alguien@example.com")).toBe(true);
    expect(esFicticio("alguien@sub.example.org")).toBe(true);
    expect(esFicticio("alguien@gmail.com")).toBe(false);
    expect(esFicticio("alguien@example.com.uy")).toBe(false);
  });
});
