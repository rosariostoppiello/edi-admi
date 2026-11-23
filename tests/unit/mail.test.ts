import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { enviarMail } = await import("@/servidor/mail");

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
    await enviarMail({ para: "vecina@example.com", asunto: "Hola", texto: "Texto", adjuntos: [{ nombre: "a.pdf", tipo: "application/pdf", contenido: Buffer.from("%PDF-") }] });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer clave-de-prueba");
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo).toMatchObject({ from: "Administración <avisos@example.com>", to: ["vecina@example.com"], subject: "Hola", text: "Texto" });
    expect(cuerpo.attachments[0]).toEqual({ filename: "a.pdf", content: Buffer.from("%PDF-").toString("base64"), content_type: "application/pdf" });
  });

  it("si Resend rechaza, tira un error (el envío queda para reintentar)", async () => {
    vi.stubEnv("MAIL_DRIVER", "resend");
    vi.stubEnv("RESEND_API_KEY", "x");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("dominio no verificado", { status: 403 })));
    await expect(enviarMail({ para: "a@example.com", asunto: "a", texto: "a" })).rejects.toThrow(/403/);
  });

  it("sin clave no intenta mandar", async () => {
    vi.stubEnv("MAIL_DRIVER", "resend");
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(enviarMail({ para: "a@example.com", asunto: "a", texto: "a" })).rejects.toThrow(/RESEND_API_KEY/);
  });
});
