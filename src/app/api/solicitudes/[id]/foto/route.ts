import { obtenerFoto } from "@/servidor/solicitudes";

/** Foto de un desperfecto. El control de acceso es el de la solicitud (`obtenerSolicitud`). */
export async function GET(_: Request, ctx: RouteContext<"/api/solicitudes/[id]/foto">) {
  const { id } = await ctx.params;
  const foto = await obtenerFoto(id);
  if (!foto) return new Response("No encontramos esa foto.", { status: 404 });
  return new Response(new Uint8Array(foto.datos), {
    headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
