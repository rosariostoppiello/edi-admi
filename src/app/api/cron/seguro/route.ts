import { revisarVencimientoSeguro } from "@/servidor/telefonos";
import { edificiosActivos } from "@/servidor/edificios";

/**
 * Revisión diaria del vencimiento del seguro (opcional: un cron del hosting la llama
 * con `Authorization: Bearer $CRON_SECRET`). Sin CRON_SECRET configurado, no existe.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return new Response("No encontrado", { status: 404 });
  let avisados = 0;
  for (const e of await edificiosActivos()) if (await revisarVencimientoSeguro(e.id)) avisados++;
  return Response.json({ avisados });
}
