import { ErrorPermiso } from "@/dominio/permisos";
import { obtenerPdf } from "@/servidor/liquidacion/consulta";

/** Descarga del PDF de una liquidación. El control de acceso está en `obtenerPdf`. */
export async function GET(request: Request, ctx: RouteContext<"/api/liquidaciones/[id]/pdf">) {
  const { id } = await ctx.params;
  let pdf;
  try {
    pdf = await obtenerPdf(id);
  } catch (e) {
    if (e instanceof ErrorPermiso) pdf = null;
    else throw e;
  }
  if (!pdf) return new Response("No encontramos esa liquidación.", { status: 404 });
  const descargar = new URL(request.url).searchParams.has("descargar");
  return new Response(new Uint8Array(pdf.datos), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${descargar ? "attachment" : "inline"}; filename="${pdf.nombre}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
