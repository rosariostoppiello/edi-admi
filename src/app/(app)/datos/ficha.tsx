import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/ui/aviso";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { Placa } from "@/componentes/ui/placa";
import { ErrorPermiso, puede } from "@/dominio/permisos";
import { NOMBRE_CALIDAD, esDueno } from "@/dominio/personas";
import { formatearCodigo } from "@/dominio/codigos";
import { obtenerFicha } from "@/servidor/datos";
import { tieneContrasena } from "@/servidor/invitaciones";
import { COLOR_TORRE } from "@/lib/edificio";
import {
  accionAgregarDestinatario,
  accionAltaInquilino,
  accionBajaInquilino,
  accionCambiarPropietario,
  accionConfirmarSinAlquilar,
  accionEditarPersona,
  accionQuitarDestinatario,
  accionReenviarInvitacion,
} from "./acciones";
import {
  AgregarDestinatario,
  CambiarPropietario,
  DarDeBaja,
  EditarPersona,
  PreguntaAlquiler,
  QuitarDestinatario,
  ReenviarInvitacion,
} from "./partes";

const TIPO: Record<string, string> = { APTO: "Apartamento", LOCAL: "Local", GARAJE: "Garaje", OFICINA: "Oficina" };

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
      <h2 className="text-titulo font-bold">{titulo}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function DatoPersona({ etiqueta, valor, ancho = false }: { etiqueta: string; valor: string; ancho?: boolean }) {
  return (
    <div className={`min-w-0 ${ancho ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <dt className="text-chico text-pizarra-suave">{etiqueta}</dt>
      <dd className="break-words font-bold">{valor}</dd>
    </div>
  );
}

export async function Ficha({ unidadId }: { unidadId: string }) {
  // Sin permiso se responde igual que si no existiera: no se revela qué unidades hay.
  const ficha = await obtenerFicha(unidadId).catch((e) => {
    if (e instanceof ErrorPermiso) return null;
    throw e;
  });
  if (!ficha) notFound();
  const { unidad, personas, destinatarios, usuario, vinculo } = ficha;

  const torre = unidad.torre.codigo;
  const codigo = (sufijo: "A" | "P" | "I") => formatearCodigo({ torre, numero: unidad.numero, sufijo });
  const dueno = personas.find((p) => esDueno(p.calidad));
  const inquilino = personas.find((p) => p.calidad === "INQUILINO");
  const yo = vinculo ? personas.find((p) => p.id === vinculo.personaId) : undefined;
  const soyDueno = !!vinculo && esDueno(vinculo.calidad);
  const sinContrasena = new Map(
    await Promise.all(personas.map(async (p) => [p.id, p.userId ? !(await tieneContrasena(p.userId)) : false] as const)),
  );

  const puedeEditar = (personaId: string) => puede(usuario, "datos.editarPersona", { unidadId, personaId });
  const puedeAlta = puede(usuario, "datos.altaInquilino", { unidadId });
  const puedeDestinatarios = puede(usuario, "datos.gestionarDestinatarios", { unidadId });
  const esAdmin = puede(usuario, "unidades.administrar");

  const tarjetaPersona = (p: (typeof personas)[number], sufijo: "A" | "P" | "I") => {
    const propia = p.id === vinculo?.personaId;
    return (
      <div className="flex flex-col gap-4" data-persona={p.calidad}>
        <div className="flex flex-wrap items-center gap-2">
          <Placa codigo={codigo(sufijo)} tamano="chica" />
          <span className="text-pizarra-suave">{NOMBRE_CALIDAD[p.calidad]}</span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DatoPersona etiqueta="Nombre" valor={p.nombre} />
          <DatoPersona etiqueta="Teléfono" valor={p.telefono} />
          <DatoPersona etiqueta="Mail" valor={p.email} ancho />
        </dl>
        {sinContrasena.get(p.id) && (
          <div className="flex flex-col gap-1">
            <p className="text-chico text-pizarra-suave">Todavía no creó su contraseña.</p>
            {puedeEditar(p.id) && <ReenviarInvitacion accion={accionReenviarInvitacion.bind(null, unidadId, p.id)} />}
          </div>
        )}
        {puedeEditar(p.id) && (
          <EditarPersona
            accion={accionEditarPersona.bind(null, unidadId, p.id)}
            valores={{ nombre: p.nombre, telefono: p.telefono, email: p.email, calidad: p.calidad }}
            conCalidad={esDueno(p.calidad)}
            textoBoton={propia ? "Editar mis datos" : "Editar datos"}
            ayudaMail={
              p.userId
                ? propia
                  ? "Es el mail con el que ingresás y donde recibís la liquidación."
                  : "Es el mail con el que ingresa y donde recibe la liquidación."
                : undefined
            }
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-grande font-bold">
          {TIPO[unidad.tipo]} {unidad.numero}
        </h1>
        <span className="flex items-center gap-2 text-pizarra-suave">
          <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: COLOR_TORRE[torre] }} />
          Torre {unidad.torre.nombre}
        </span>
      </div>
      <p className="max-w-prose text-pizarra-suave">
        {unidad.arrendada
          ? `Está alquilada: en la liquidación figura como ${codigo("P")} (propietario) y ${codigo("I")} (inquilino).`
          : `No está alquilada: en la liquidación figura como ${codigo("A")}.`}
      </p>

      {yo && !yo.datosConfirmadosEn && (
        <Aviso tono="info">
          Revisá que tus datos estén bien{soyDueno && !unidad.arrendada ? " y contanos si la unidad está alquilada" : ""}.
          A este mail te llegan la liquidación y los comunicados.
        </Aviso>
      )}

      <Seccion titulo={vinculo && !soyDueno ? "Tus datos" : "Responsable"}>
        {vinculo && !soyDueno && yo
          ? tarjetaPersona(yo, "I")
          : dueno
            ? tarjetaPersona(dueno, unidad.arrendada ? "P" : "A")
            : <Aviso tono="error">La unidad no tiene propietario cargado.</Aviso>}
        {esAdmin && <CambiarPropietario accion={accionCambiarPropietario.bind(null, unidadId)} />}
      </Seccion>

      {(soyDueno || puede(usuario, "datos.verTodos")) && (
        <Seccion titulo="Inquilino">
          <ZonaAvisos>
            {inquilino ? (
              <>
                {tarjetaPersona(inquilino, "I")}
                {puede(usuario, "datos.bajaInquilino", { unidadId, personaId: inquilino.id }) && (
                  <DarDeBaja
                    accion={accionBajaInquilino.bind(null, unidadId, inquilino.id)}
                    propia={false}
                    nombre={inquilino.nombre}
                    codigoP={codigo("P")}
                  />
                )}
              </>
            ) : puedeAlta ? (
              <>
                <p className="font-bold">
                  {soyDueno && !yo?.datosConfirmadosEn
                    ? "¿La unidad está alquilada?"
                    : "La unidad figura sin alquilar. Si la alquilás, cargá acá al inquilino."}
                </p>
                <PreguntaAlquiler
                  confirmarSinAlquilar={accionConfirmarSinAlquilar.bind(null, unidadId, vinculo?.personaId ?? dueno?.id ?? "")}
                  altaInquilino={accionAltaInquilino.bind(null, unidadId)}
                  yaConfirmado={!soyDueno || !!yo?.datosConfirmadosEn}
                />
              </>
            ) : (
              <p className="text-pizarra-suave">La unidad no tiene inquilino.</p>
            )}
          </ZonaAvisos>
        </Seccion>
      )}

      {vinculo && !soyDueno && yo && (
        <Seccion titulo="Dejar la unidad">
          <DarDeBaja accion={accionBajaInquilino.bind(null, unidadId, yo.id)} propia nombre={yo.nombre} codigoP={codigo("P")} />
        </Seccion>
      )}

      {puedeDestinatarios && (
        <Seccion titulo="Otros mails que reciben la liquidación">
          <p className="max-w-prose text-pizarra-suave">
            Por ejemplo, otro copropietario. Reciben la liquidación y los comunicados, pero no entran al sistema.
          </p>
          {destinatarios.length > 0 ? (
            <ul className="flex flex-col divide-y divide-junta">
              {destinatarios.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">
                    <span className="font-bold">{d.email}</span>
                    {d.nombre && <span className="text-pizarra-suave"> ({d.nombre})</span>}
                  </span>
                  <QuitarDestinatario accion={accionQuitarDestinatario.bind(null, unidadId, d.id)} email={d.email} />
                </li>
              ))}
            </ul>
          ) : (
            <p>Todavía no agregaste otros mails.</p>
          )}
          <AgregarDestinatario accion={accionAgregarDestinatario.bind(null, unidadId)} />
        </Seccion>
      )}
    </div>
  );
}
