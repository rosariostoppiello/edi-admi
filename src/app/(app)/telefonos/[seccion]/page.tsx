import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Aviso } from "@/componentes/ui/aviso";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { IconoTelefonos } from "@/componentes/ui/iconos";
import { puede } from "@/dominio/permisos";
import { enlaceTelefono, separarTelefonos } from "@/dominio/telefonos";
import { exigirPermiso, exigirUsuario } from "@/servidor/sesion";
import { listarContactos, obtenerFicha, polizaVigente, revisarVencimientoSeguro, type TipoContacto } from "@/servidor/telefonos";
import { Volver } from "../../datos/volver";
import { buscarModulo } from "../../modulos";
import { accionBorrarContacto, accionContacto, accionFicha, accionPoliza } from "../acciones";
import { FormDesplegable, Quitar, type DefCampo } from "../partes";

const SECCIONES = ["administracion", "comision", "porteria", "empresas", "servicios", "seguro"] as const;
type Seccion = (typeof SECCIONES)[number];

function nombreSeccion(seccion: string) {
  return buscarModulo("/telefonos")!.subteclas.find((s) => s.ruta === `/telefonos/${seccion}`)?.nombre;
}

export async function generateMetadata({ params }: PageProps<"/telefonos/[seccion]">): Promise<Metadata> {
  return { title: nombreSeccion((await params).seccion) ?? "Teléfonos" };
}

const fecha = (f: string) => f.split("-").reverse().join("/");
const fechaHora = (d: Date) => new Intl.DateTimeFormat("es-UY", { timeZone: "America/Montevideo", day: "numeric", month: "numeric", year: "numeric" }).format(d);

/** Un botón de llamar por cada teléfono (tel:). */
function Llamar({ telefonos }: { telefonos: string }) {
  const lista = separarTelefonos(telefonos);
  if (lista.length === 0) return telefonos ? <p>{telefonos}</p> : null;
  return (
    <div className="flex flex-wrap gap-2">
      {lista.map((t) => (
        <a
          key={t}
          href={enlaceTelefono(t) ?? undefined}
          className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-campo)] border-2 border-bronce bg-losa px-4 font-bold tabular-nums hover:bg-bronce-fuerte hover:text-white"
        >
          <IconoTelefonos className="size-5" aria-hidden="true" />
          <span className="sr-only">Llamar al </span>
          {t}
        </a>
      ))}
    </div>
  );
}

function Tarjeta({ titulo, children, id }: { titulo: string; children: ReactNode; id?: string }) {
  return (
    <article aria-labelledby={id} className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
      <h2 id={id} className="text-medio font-bold leading-tight">
        {titulo}
      </h2>
      {children}
    </article>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div>
      <dt className="text-chico text-pizarra-suave">{etiqueta}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

const Vacio = ({ admin, texto }: { admin: boolean; texto: string }) => (
  <p className="text-pizarra-suave">{admin ? texto : "Todavía no hay datos cargados. Consultá con la Administración."}</p>
);

const CAMPOS_CONTACTO: Record<TipoContacto, (c?: { nombre: string; detalle: string; telefono: string; unidad: string; cuenta: string; titular: string }) => DefCampo[]> = {
  COMISION: (c) => [
    { name: "nombre", etiqueta: "Nombre y apellido", valor: c?.nombre },
    { name: "detalle", etiqueta: "Cargo (opcional)", valor: c?.detalle, ayuda: "Ej. Presidente, Tesorera" },
    { name: "unidad", etiqueta: "Unidad", valor: c?.unidad, ayuda: "Ej. 2-101" },
    { name: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: c?.telefono },
  ],
  EMPRESA: (c) => [
    { name: "nombre", etiqueta: "Empresa", valor: c?.nombre },
    { name: "detalle", etiqueta: "Rubro", valor: c?.detalle, ayuda: "Ej. Ascensores, Limpieza, Bombas de agua" },
    { name: "telefono", etiqueta: "Teléfono", tipo: "tel", valor: c?.telefono, ayuda: "Si son varios, separalos con /" },
  ],
  SERVICIO: (c) => [
    { name: "nombre", etiqueta: "Servicio", valor: c?.nombre, ayuda: "Ej. UTE espacios comunes, OSE" },
    { name: "detalle", etiqueta: "Dirección o servicio", valor: c?.detalle },
    { name: "cuenta", etiqueta: "Número de cuenta", valor: c?.cuenta },
    { name: "titular", etiqueta: "Titular", valor: c?.titular },
    { name: "telefono", etiqueta: "Teléfono de reclamos (opcional)", tipo: "tel", valor: c?.telefono },
  ],
};

async function Contactos({ tipo, admin }: { tipo: TipoContacto; admin: boolean }) {
  const lista = await listarContactos(tipo);
  const singular = { COMISION: "un integrante", EMPRESA: "una empresa", SERVICIO: "un servicio" }[tipo];
  const consentimiento = (marcada: boolean) =>
    tipo === "COMISION"
      ? {
          name: "consentimiento",
          etiqueta: "Dio su consentimiento para mostrar su nombre, unidad y teléfono a todos",
          ayuda: "Ley 18.331. Sin consentimiento, solo lo ve la Administración.",
          marcada,
        }
      : undefined;
  return (
    <div className="flex flex-col gap-4">
      {tipo === "COMISION" && <p className="max-w-prose text-pizarra-suave">Se muestran solo los integrantes que dieron su consentimiento para publicar sus datos.</p>}
      {admin && (
        <FormDesplegable textoDesplegar={`Agregar ${singular}`} accion={accionContacto.bind(null, tipo, null)} campos={CAMPOS_CONTACTO[tipo]()} casilla={consentimiento(false)} textoBoton="Agregar" limpiar />
      )}
      {lista.length === 0 ? (
        <Vacio admin={admin} texto={`Todavía no cargaste ${tipo === "COMISION" ? "integrantes" : tipo === "EMPRESA" ? "empresas" : "servicios"}.`} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {lista.map((c) => (
            <li key={c.id}>
              <Tarjeta titulo={c.nombre} id={`c-${c.id}`}>
                <dl className="flex flex-col gap-2">
                  <Dato etiqueta={tipo === "COMISION" ? "Cargo" : tipo === "EMPRESA" ? "Rubro" : "Dirección o servicio"}>{c.detalle}</Dato>
                  {tipo === "COMISION" && <Dato etiqueta="Unidad">{c.unidad && <span className="font-mono font-bold">{c.unidad}</span>}</Dato>}
                  {tipo === "SERVICIO" && (
                    <>
                      <Dato etiqueta="Número de cuenta">{c.cuenta && <span className="font-mono font-bold">{c.cuenta}</span>}</Dato>
                      <Dato etiqueta="Titular">{c.titular}</Dato>
                    </>
                  )}
                </dl>
                <Llamar telefonos={c.telefono} />
                {admin && (
                  <div className="flex flex-col gap-3 border-t border-junta pt-3">
                    {tipo === "COMISION" && (
                      <p className="text-chico text-pizarra-suave">
                        {c.consentimientoEn
                          ? `Consentimiento registrado el ${fechaHora(c.consentimientoEn)}${c.consentimientoRegistradoPor ? ` por ${c.consentimientoRegistradoPor.name}` : ""}.`
                          : "Sin consentimiento: no lo ven los demás."}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <FormDesplegable
                        textoDesplegar="Editar"
                        accion={accionContacto.bind(null, tipo, c.id)}
                        campos={CAMPOS_CONTACTO[tipo](c)}
                        casilla={consentimiento(Boolean(c.consentimientoEn))}
                        textoBoton="Guardar cambios"
                      />
                      <Quitar accion={accionBorrarContacto.bind(null, c.id)} nombre={c.nombre} />
                    </div>
                  </div>
                )}
              </Tarjeta>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Administracion({ admin }: { admin: boolean }) {
  const f = await obtenerFicha("ADMINISTRACION");
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {f ? (
        <Tarjeta titulo={f.nombre ?? "Administración"}>
          <dl className="flex flex-col gap-2">
            <Dato etiqueta="Mail">{f.mail && <a className="font-bold underline underline-offset-4" href={`mailto:${f.mail}`}>{f.mail}</a>}</Dato>
            <Dato etiqueta="Dirección">{f.direccion}</Dato>
            <Dato etiqueta="Horario de atención">{f.horario}</Dato>
          </dl>
          <Llamar telefonos={f.celulares ?? ""} />
        </Tarjeta>
      ) : (
        <Vacio admin={admin} texto="Todavía no cargaste los datos de la Administración." />
      )}
      {admin && (
        <FormDesplegable
          textoDesplegar={f ? "Editar" : "Cargar los datos"}
          accion={accionFicha.bind(null, "ADMINISTRACION")}
          campos={[
            { name: "nombre", etiqueta: "Nombre", valor: f?.nombre },
            { name: "mail", etiqueta: "Mail", tipo: "email", valor: f?.mail },
            { name: "direccion", etiqueta: "Dirección", valor: f?.direccion },
            { name: "celulares", etiqueta: "Celulares", tipo: "tel", valor: f?.celulares, ayuda: "Si son varios, separalos con /" },
            { name: "horario", etiqueta: "Horario de atención", valor: f?.horario, area: true },
          ]}
          textoBoton="Guardar"
        />
      )}
    </div>
  );
}

async function Porteria({ admin }: { admin: boolean }) {
  const f = await obtenerFicha("PORTERIA");
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {f ? (
        <Tarjeta titulo="Portería">
          <dl className="flex flex-col gap-2">
            <Dato etiqueta="Empresa">{f.empresa}</Dato>
            <Dato etiqueta="Horarios">{f.horario}</Dato>
          </dl>
          <Llamar telefonos={f.telefono ?? ""} />
        </Tarjeta>
      ) : (
        <Vacio admin={admin} texto="Todavía no cargaste los datos de la Portería." />
      )}
      {admin && (
        <FormDesplegable
          textoDesplegar={f ? "Editar" : "Cargar los datos"}
          accion={accionFicha.bind(null, "PORTERIA")}
          campos={[
            { name: "empresa", etiqueta: "Empresa de portería", valor: f?.empresa },
            { name: "telefono", etiqueta: "Teléfono de la portería", tipo: "tel", valor: f?.telefono },
            { name: "horario", etiqueta: "Horarios", valor: f?.horario, area: true },
          ]}
          textoBoton="Guardar"
        />
      )}
    </div>
  );
}

async function Seguro({ admin }: { admin: boolean }) {
  if (admin) await revisarVencimientoSeguro((await exigirUsuario()).edificio.id);
  const p = await polizaVigente();
  const campos = (v?: typeof p): DefCampo[] => [
    { name: "aseguradora", etiqueta: "Aseguradora", valor: v?.aseguradora },
    { name: "numero", etiqueta: "Número de póliza", valor: v?.numero },
    { name: "desde", etiqueta: "Vigencia desde", tipo: "date", valor: v?.desdeTexto },
    { name: "hasta", etiqueta: "Vigencia hasta", tipo: "date", valor: v?.hastaTexto },
    { name: "telefono", etiqueta: "Teléfono de siniestros (opcional)", tipo: "tel", valor: v?.telefono },
    { name: "cobertura", etiqueta: "Cobertura (opcional)", valor: v?.cobertura, area: true },
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {p && p.estado !== "VIGENTE" && (
        <Aviso tono="error">
          La póliza {p.frase} ({fecha(p.hastaTexto)}).{admin ? " Cuando la renueves, cargá la nueva vigencia." : ""}
        </Aviso>
      )}
      {p ? (
        <Tarjeta titulo={p.aseguradora}>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Dato etiqueta="Número de póliza">
              <span className="font-mono font-bold">{p.numero}</span>
            </Dato>
            <Dato etiqueta="Vigencia">
              {fecha(p.desdeTexto)} al {fecha(p.hastaTexto)}
            </Dato>
            <Dato etiqueta="Cobertura">{p.cobertura}</Dato>
          </dl>
          <Llamar telefonos={p.telefono} />
        </Tarjeta>
      ) : (
        <Vacio admin={admin} texto="Todavía no cargaste la póliza del seguro de incendio." />
      )}
      {admin && (
        <div className="flex flex-wrap gap-3">
          {p && <FormDesplegable textoDesplegar="Corregir los datos" accion={accionPoliza.bind(null, p.id)} campos={campos(p)} textoBoton="Guardar cambios" />}
          <FormDesplegable textoDesplegar={p ? "Cargar la renovación" : "Cargar la póliza"} accion={accionPoliza.bind(null, null)} campos={campos()} textoBoton="Guardar" />
        </div>
      )}
    </div>
  );
}

/** Cada sección de Teléfonos: todos ven; solo Administración carga y edita. */
export default async function PaginaSeccion({ params }: PageProps<"/telefonos/[seccion]">) {
  const usuario = await exigirPermiso("telefonos.ver");
  const { seccion } = await params;
  if (!SECCIONES.includes(seccion as Seccion)) notFound();
  const admin = puede(usuario, "telefonos.editar");
  const contenido: Record<Seccion, ReactNode> = {
    administracion: <Administracion admin={admin} />,
    comision: <Contactos tipo="COMISION" admin={admin} />,
    porteria: <Porteria admin={admin} />,
    empresas: <Contactos tipo="EMPRESA" admin={admin} />,
    servicios: <Contactos tipo="SERVICIO" admin={admin} />,
    seguro: <Seguro admin={admin} />,
  };
  return (
    <>
      <Volver href="/telefonos" texto="Teléfonos y datos de interés" />
      <div className="mt-4 flex items-center gap-3">
        <IconoTelefonos className="size-10 shrink-0 text-bronce-texto" />
        <h1 className="text-grande font-bold">{nombreSeccion(seccion)}</h1>
      </div>
      <div className="mt-6">
        <ZonaAvisos>{contenido[seccion as Seccion]}</ZonaAvisos>
      </div>
    </>
  );
}
