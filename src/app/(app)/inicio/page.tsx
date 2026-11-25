import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/servidor/sesion";
import { Aviso } from "@/componentes/ui/aviso";
import { Tecla } from "@/componentes/ui/teclas";
import { alertaSeguro } from "@/servidor/telefonos";
import { MODULOS } from "../modulos";

export const metadata: Metadata = { title: "Inicio" };

export default async function Inicio() {
  const usuario = await exigirUsuario();
  // Para Administración revisa el vencimiento del seguro y le manda el mail (una vez por
  // vigencia); el aviso ya no se muestra acá: queda en Teléfonos → Seguro de incendio.
  await alertaSeguro();

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


      <nav aria-label="Secciones">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {MODULOS.map(({ ruta, nombre, descripcion, Icono }) => (
            <li key={ruta}>
              <Tecla href={ruta} nombre={nombre} descripcion={descripcion} Icono={Icono} />
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
