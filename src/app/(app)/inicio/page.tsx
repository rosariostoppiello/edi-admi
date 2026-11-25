import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { exigirUsuario } from "@/servidor/sesion";
import { Aviso } from "@/componentes/ui/aviso";
import { Tecla } from "@/componentes/ui/teclas";
import { alertaSeguro } from "@/servidor/telefonos";
import { modulosDelEdificio } from "../modulos";
import { puede } from "@/dominio/permisos";
import { pedidosPendientes } from "@/servidor/accesos";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio() {
  const usuario = await exigirUsuario();
  // En varios edificios y sin elegir todavía: primero se elige el edificio.
  if (!usuario.edificioElegido) redirect("/edificios");
  // Para Administración revisa el vencimiento del seguro y le manda el mail (una vez por
  // vigencia); el aviso ya no se muestra acá: queda en Teléfonos → Seguro de incendio.
  await alertaSeguro();
  const pedidos = puede(usuario, "usuarios.administrar") ? await pedidosPendientes(usuario.edificio.id) : 0;

  return (
    <>
      <h1 className="sr-only">Inicio</h1>

      {usuario.unidadesDetalle.some((u) => !u.datosConfirmados) && (
        <div className="mb-5 max-w-2xl">
          <Aviso tono="info">
            Revisá tus datos de contacto: a ese mail te llegan la liquidación y los comunicados.{" "}
            <Link href="/datos/editar" className="underline underline-offset-4 hover:text-bronce">
              Revisar mis datos
            </Link>
          </Aviso>
        </div>
      )}


      {pedidos > 0 && (
        <div className="mb-5 max-w-2xl">
          <Aviso tono="info">
            {pedidos === 1 ? "Hay 1 pedido de acceso para revisar." : `Hay ${pedidos} pedidos de acceso para revisar.`}{" "}
            <Link href="/datos/accesos" className="underline underline-offset-4 hover:text-bronce">
              Revisar
            </Link>
          </Aviso>
        </div>
      )}

      <nav aria-label="Secciones">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {modulosDelEdificio(usuario.edificio.modulos).map(({ ruta, nombre, descripcion, Icono }) => (
            <li key={ruta}>
              <Tecla href={ruta} nombre={nombre} descripcion={descripcion} Icono={Icono} />
            </li>
          ))}
        </ul>
      </nav>

      {(puede(usuario, "edificio.configurarModulos") || usuario.duenoSistema) && (
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
          {puede(usuario, "edificio.configurarModulos") && (
            <Link href="/edificio" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
              Configuración del edificio
            </Link>
          )}
          {usuario.duenoSistema && (
            <Link href="/sistema" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4 hover:text-bronce">
              Edificios del sistema
            </Link>
          )}
        </p>
      )}
    </>
  );
}
