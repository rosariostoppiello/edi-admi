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
  const nombre = usuario.nombre.split(" ")[0];
  const seguro = await alertaSeguro();

  return (
    <>
      <h1 className="text-grande font-bold md:text-enorme">Hola, {nombre}</h1>
      <p className="mt-1 text-pizarra-suave">¿Qué necesitás hacer?</p>

      {usuario.unidadesDetalle.some((u) => !u.datosConfirmados) && (
        <div className="mt-5 max-w-2xl">
          <Aviso tono="info">
            Revisá tus datos de contacto: a ese mail te llegan la liquidación y los comunicados.{" "}
            <Link href="/datos/editar" className="underline underline-offset-4 hover:text-bronce">
              Revisar mis datos
            </Link>
          </Aviso>
        </div>
      )}

      {seguro && (
        <div className="mt-5 max-w-2xl">
          <Aviso tono="error">
            El seguro de incendio {seguro.frase}.{" "}
            <Link href="/telefonos/seguro" className="underline underline-offset-4">
              Ver la póliza
            </Link>
          </Aviso>
        </div>
      )}

      <nav aria-label="Secciones" className="mt-6 md:mt-8">
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
