import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { Volver } from "../../datos/volver";
import { buscarModulo, subteclasVisibles } from "../../modulos";

/** Sub-botón de un módulo que todavía no está implementado. */
function buscar(modulo: string, sub: string) {
  const m = buscarModulo(`/${modulo}`);
  const s = m?.subteclas.find((t) => t.ruta === `/${modulo}/${sub}`);
  return m && s ? { modulo: m, sub: s } : null;
}

export async function generateMetadata({ params }: PageProps<"/[modulo]/[sub]">): Promise<Metadata> {
  const { modulo, sub } = await params;
  return { title: buscar(modulo, sub)?.sub.nombre ?? "Sección" };
}

export default async function SeccionPendiente({ params }: PageProps<"/[modulo]/[sub]">) {
  const usuario = await exigirUsuario();
  const { modulo: m, sub: s } = await params;
  const encontrado = buscar(m, s);
  if (!encontrado) notFound();
  const { modulo, sub } = encontrado;
  if (sub.visible && !sub.visible(usuario)) notFound();
  const unaSola = subteclasVisibles(modulo.subteclas, usuario).length === 1;

  return (
    <>
      <Volver href={unaSola ? "/" : modulo.ruta} texto={unaSola ? "Inicio" : modulo.nombre} />
      <div className="mt-4 flex items-center gap-3">
        <modulo.Icono className="size-10 shrink-0 text-bronce" />
        <h1 className="text-grande font-bold">{sub.nombre}</h1>
      </div>
      <div className="mt-6 max-w-prose rounded-[var(--radius-tecla)] border border-junta bg-losa p-5 md:p-6">
        <p className="font-bold">Esta sección todavía está en construcción.</p>
        <p className="mt-2 text-pizarra-suave">
          Mientras tanto, cualquier consulta hacela directamente con la Administración.
        </p>
      </div>
    </>
  );
}
