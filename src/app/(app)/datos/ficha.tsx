import { notFound } from "next/navigation";
import { Aviso } from "@/componentes/ui/aviso";
import { ZonaAvisos } from "@/componentes/ui/formularios";
import { Placa } from "@/componentes/ui/placa";
import { ErrorPermiso, puede } from "@/dominio/permisos";
import { NOMBRE_CALIDAD, esDueno, nombreCompleto } from "@/dominio/personas";
import { formatearCodigo } from "@/dominio/codigos";
import {
  historialUnidad,
  obtenerFicha,
  ventaPendiente,
} from "@/servidor/datos";
import { formatearFecha } from "@/dominio/liquidacion/periodo";
import { tieneContrasena } from "@/servidor/invitaciones";
import { colorTorre } from "@/lib/edificio";
import {
  accionAgregarDestinatario,
  accionAltaInquilino,
  accionAvisarVenta,
  accionBajaInquilino,
  accionCambiarPropietario,
  accionConfirmarSinAlquilar,
  accionConfirmarVenta,
  accionEditarPersona,
  accionQuitarDestinatario,
  accionReenviarInvitacion,
  accionRechazarVenta,
} from "./acciones";
import {
  AgregarDestinatario,
  AvisarVenta,
  CambiarPropietario,
  DarDeBaja,
  EditarPersona,
  PreguntaAlquiler,
  QuitarDestinatario,
  ReenviarInvitacion,
  RevisarVenta,
} from "./partes";

const TIPO: Record<string, string> = {
  APTO: "Apartamento",
  LOCAL: "Local",
  GARAJE: "Garaje",
  OFICINA: "Oficina",
};

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6">
      <h2 className="text-titulo font-bold">{titulo}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function DatoPersona({
  etiqueta,
  valor,
  ancho = false,
}: {
  etiqueta: string;
  valor: string;
  ancho?: boolean;
}) {
  return (
    <div className={`min-w-0 ${ancho ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <dt className="text-chico text-pizarra-suave">{etiqueta}</dt>
      <dd className="break-words font-bold">{valor}</dd>
    </div>
  );
}

/**
 * Ficha de una unidad. En modo "ver" muestra los datos propios sin formularios
 * (pantalla de Datos); en modo "editar", el flujo completo (tecla Editar y
 * Administración). `acciones` va debajo del encabezado (ej. la tecla Editar).
 */
export async function Ficha({
  unidadId,
  modo = "editar",
  acciones,
}: {
  unidadId: string;
  modo?: "ver" | "editar";
  acciones?: React.ReactNode;
}) {
  // Sin permiso se responde igual que si no existiera: no se revela qué unidades hay.
  const ficha = await obtenerFicha(unidadId).catch((e) => {
    if (e instanceof ErrorPermiso) return null;
    throw e;
  });
  if (!ficha) notFound();
  const { unidad, personas, destinatarios, usuario, vinculo } = ficha;

  const torre = unidad.torre.numero;
  const codigo = (sufijo: "A" | "P" | "I") =>
    formatearCodigo({ torre, numero: unidad.numero, sufijo });
  const dueno = personas.find((p) => esDueno(p.calidad));
  const inquilino = personas.find((p) => p.calidad === "INQUILINO");
  const yo = vinculo
    ? personas.find((p) => p.id === vinculo.personaId)
    : undefined;
  const soyDueno = !!vinculo && esDueno(vinculo.calidad);
  const sinContrasena = new Map(
    await Promise.all(
      personas.map(
        async (p) =>
          [
            p.id,
            p.userId ? !(await tieneContrasena(p.userId)) : false,
          ] as const,
      ),
    ),
  );

  const edita = modo === "editar";
  const puedeEditar = (personaId: string) =>
    edita && puede(usuario, "datos.editarPersona", { unidadId, personaId });
  const puedeAlta =
    edita && puede(usuario, "datos.altaInquilino", { unidadId });
  const puedeDestinatarios = puede(usuario, "datos.gestionarDestinatarios", {
    unidadId,
  });
  const esAdmin = edita && puede(usuario, "unidades.administrar");
  const venta = soyDueno || esAdmin ? await ventaPendiente(unidadId) : null;
  const historial =
    edita && puede(usuario, "datos.verTodos")
      ? await historialUnidad(unidadId)
      : [];

  const tarjetaPersona = (
    p: (typeof personas)[number],
    sufijo: "A" | "P" | "I",
  ) => {
    const propia = p.id === vinculo?.personaId;
    return (
      <div className="flex flex-col gap-4" data-persona={p.calidad}>
        <div className="flex flex-wrap items-center gap-2">
          <Placa codigo={codigo(sufijo)} tamano="chica" />
          <span className="text-pizarra-suave">
            {NOMBRE_CALIDAD[p.calidad]}
          </span>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DatoPersona etiqueta="Nombre" valor={p.nombre} />
          <DatoPersona etiqueta="Apellido" valor={p.apellido || "—"} />
          <DatoPersona etiqueta="Teléfono" valor={p.telefono} />
          <DatoPersona etiqueta="Mail" valor={p.email} ancho />
        </dl>
        {sinContrasena.get(p.id) && (
          <div className="flex flex-col gap-1">
            <p className="text-chico text-pizarra-suave">
              Todavía no creó su contraseña.
            </p>
            {puedeEditar(p.id) && (
              <ReenviarInvitacion
                accion={accionReenviarInvitacion.bind(null, unidadId, p.id)}
              />
            )}
          </div>
        )}
        {puedeEditar(p.id) && (
          <EditarPersona
            accion={accionEditarPersona.bind(null, unidadId, p.id)}
            valores={{
              nombre: p.nombre,
              apellido: p.apellido,
              telefono: p.telefono,
              email: p.email,
              calidad: p.calidad,
            }}
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
          <span
            aria-hidden="true"
            className="inline-block size-3 rounded-full"
            style={{ background: colorTorre(unidad.torre.color) }}
          />
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
          Revisá que tus datos estén bien
          {soyDueno && !unidad.arrendada
            ? " y contanos si la unidad está alquilada"
            : ""}
          . A este mail te llegan la liquidación y los comunicados.
          {edita ? "" : " Tocá Editar para hacerlo."}
        </Aviso>
      )}

      {acciones}

      {/* El aviso de éxito queda afuera de la sección de venta, que desaparece al confirmarla. */}
      <ZonaAvisos>
        {venta && esAdmin && (
          <Seccion titulo="Aviso de venta">
            <>
              <p className="max-w-prose">
                {venta.autor?.name ?? "El propietario"} avisó el{" "}
                {formatearFecha(venta.creadaEn.toISOString())} que vendió la
                unidad
                {venta.aviso
                  ? ` a ${nombreCompleto(venta.aviso)} (${NOMBRE_CALIDAD[venta.aviso.calidad].toLowerCase()}).`
                  : "."}
              </p>
              {venta.aviso && (
                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <DatoPersona
                    etiqueta="Teléfono del comprador"
                    valor={venta.aviso.telefono}
                  />
                  <DatoPersona
                    etiqueta="Mail del comprador"
                    valor={venta.aviso.email}
                    ancho
                  />
                </dl>
              )}
              {venta.texto && (
                <p className="text-pizarra-suave">
                  Comentario: “{venta.texto}”
                </p>
              )}
              {venta.aviso ? (
                <RevisarVenta
                  confirmar={accionConfirmarVenta.bind(null, unidadId)}
                  rechazar={accionRechazarVenta.bind(null, unidadId)}
                  comprador={nombreCompleto(venta.aviso)}
                />
              ) : (
                <p className="text-pizarra-suave">
                  Cargá al nuevo propietario con “Cambiar de propietario”.
                </p>
              )}
            </>
          </Seccion>
        )}

        <Seccion titulo={vinculo && !soyDueno ? "Tus datos" : "Responsable"}>
          {vinculo && !soyDueno && yo ? (
            tarjetaPersona(yo, "I")
          ) : dueno ? (
            tarjetaPersona(dueno, unidad.arrendada ? "P" : "A")
          ) : (
            <Aviso tono="error">La unidad no tiene propietario cargado.</Aviso>
          )}
          {esAdmin && (
            <CambiarPropietario
              accion={accionCambiarPropietario.bind(null, unidadId)}
            />
          )}
        </Seccion>
      </ZonaAvisos>

      {(soyDueno || puede(usuario, "datos.verTodos")) && (
        <Seccion titulo="Inquilino">
          <ZonaAvisos>
            {inquilino ? (
              <>
                {tarjetaPersona(inquilino, "I")}
                {edita &&
                  puede(usuario, "datos.bajaInquilino", {
                    unidadId,
                    personaId: inquilino.id,
                  }) && (
                    <DarDeBaja
                      accion={accionBajaInquilino.bind(
                        null,
                        unidadId,
                        inquilino.id,
                      )}
                      propia={false}
                      nombre={nombreCompleto(inquilino)}
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
                  confirmarSinAlquilar={accionConfirmarSinAlquilar.bind(
                    null,
                    unidadId,
                    vinculo?.personaId ?? dueno?.id ?? "",
                  )}
                  altaInquilino={accionAltaInquilino.bind(null, unidadId)}
                  yaConfirmado={!soyDueno || !!yo?.datosConfirmadosEn}
                />
              </>
            ) : (
              <p className="text-pizarra-suave">
                La unidad no está alquilada: no tiene inquilino.
              </p>
            )}
          </ZonaAvisos>
        </Seccion>
      )}

      {edita && vinculo && !soyDueno && yo && (
        <Seccion titulo="Dejar la unidad">
          <DarDeBaja
            accion={accionBajaInquilino.bind(null, unidadId, yo.id)}
            propia
            nombre={nombreCompleto(yo)}
            codigoP={codigo("P")}
          />
        </Seccion>
      )}

      {puedeDestinatarios && (
        <Seccion titulo="Otros mails que reciben la liquidación">
          <p className="max-w-prose text-pizarra-suave">
            Por ejemplo, otro copropietario. Reciben la liquidación y los
            comunicados, pero no entran al sistema.
          </p>
          {destinatarios.length > 0 ? (
            <ul className="flex flex-col divide-y divide-junta">
              {destinatarios.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="min-w-0 break-words">
                    <span className="font-bold">{d.email}</span>
                    {d.nombre && (
                      <span className="text-pizarra-suave"> ({d.nombre})</span>
                    )}
                  </span>
                  {edita && (
                    <QuitarDestinatario
                      accion={accionQuitarDestinatario.bind(
                        null,
                        unidadId,
                        d.id,
                      )}
                      email={d.email}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Todavía no agregaste otros mails.</p>
          )}
          {edita && (
            <AgregarDestinatario
              accion={accionAgregarDestinatario.bind(null, unidadId)}
            />
          )}
        </Seccion>
      )}

      {soyDueno && !edita && (
        <Seccion titulo="¿Vendiste la unidad?">
          {venta ? (
            <Aviso tono="ok">
              Avisaste la venta el{" "}
              {formatearFecha(venta.creadaEn.toISOString())}
              {venta.aviso ? ` a ${nombreCompleto(venta.aviso)}` : ""}. Cuando
              la Administración la confirme, el comprador recibe su usuario y
              vos dejás de figurar en la unidad.
            </Aviso>
          ) : (
            <>
              <p className="max-w-prose text-pizarra-suave">
                Cargá los datos del comprador. La Administración lo revisa y, al
                confirmarlo, el comprador queda como responsable con su usuario
                y vos salís. La unidad nunca queda sin dueño y tu saldo queda en
                la cuenta de la unidad.
              </p>
              <AvisarVenta accion={accionAvisarVenta.bind(null, unidadId)} />
            </>
          )}
        </Seccion>
      )}
      {historial.length > 0 && (
        <Seccion titulo="Historial de la unidad">
          <p className="max-w-prose text-pizarra-suave">
            Quiénes figuraron como responsables e inquilinos, con sus fechas de
            alta y baja.
          </p>
          <ul className="flex flex-col divide-y divide-junta">
            {historial.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <span>
                  <span className="font-bold">{nombreCompleto(h)}</span>{" "}
                  <span className="text-pizarra-suave">
                    ({NOMBRE_CALIDAD[h.calidad].toLowerCase()})
                  </span>
                </span>
                <span className="text-chico text-pizarra-suave">
                  Desde {formatearFecha(h.altaEn.toISOString())}
                  {h.bajaEn
                    ? ` hasta ${formatearFecha(h.bajaEn.toISOString())}`
                    : h.activa
                      ? " · actual"
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      )}
    </div>
  );
}
