import { ErrorPermiso } from "@/dominio/permisos";
import { obtenerPdfComunicado } from "@/servidor/comunicados";

/** Descarga del PDF de un comunicado. El control de acceso está en `obtenerPdfComunicado`. */
export async function GET(request: Request, ctx: RouteContext<"/api/comunicados/[id]/pdf">) {
  const { id } = await ctx.params;
  let pdf;
  try {
    pdf = await obtenerPdfComunicado(id);
  } catch (e) {
    if (e instanceof ErrorPermiso) pdf = null;
    else throw e;
  }
  if (!pdf) return new Response("No encontramos ese documento.", { status: 404 });
  const descargar = new URL(request.url).searchParams.has("descargar");
  return new Response(new Uint8Array(pdf.datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${pdf.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
