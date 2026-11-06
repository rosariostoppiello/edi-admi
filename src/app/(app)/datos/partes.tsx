"use client";
/**
 * Partes interactivas de la ficha de una unidad. Reciben server actions ya
 * "atadas" (bind) a la unidad/persona; el servidor vuelve a chequear permisos.
 */
import { useActionState } from "react";
import {
  AccionConfirmada,
  Desplegable,
  FormPersona,
  MensajeEstado,
  type Estado,
  type ValoresPersona,
} from "@/componentes/ui/formularios";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;
type AccionSimple = (estado: Estado) => Promise<Estado>;

export function EditarPersona({
  accion,
  valores,
  conCalidad,
  textoBoton,
  ayudaMail,
}: {
  accion: AccionForm;
  valores: ValoresPersona;
  conCalidad: boolean;
  textoBoton: string;
  ayudaMail?: string;
}) {
  return (
    <Desplegable textoBoton={textoBoton}>
      {() => (
        <FormPersona accion={accion} valores={valores} conCalidad={conCalidad} textoBoton="Guardar cambios" ayudaMail={ayudaMail} />
      )}
    </Desplegable>
  );
}

/** "¿La unidad está alquilada?" → No: confirma código A. Sí: formulario del inquilino. */
export function PreguntaAlquiler({
  confirmarSinAlquilar,
  altaInquilino,
  yaConfirmado,
}: {
  confirmarSinAlquilar: AccionSimple;
  altaInquilino: AccionForm;
  yaConfirmado: boolean;
}) {
  const [estadoNo, enviarNo, pendienteNo] = useActionState(confirmarSinAlquilar, null);

  return (
    <div className="flex flex-col gap-4">
      <MensajeEstado estado={estadoNo} />
      {!yaConfirmado && !estadoNo?.ok && (
        <form action={enviarNo}>
          <Boton type="submit" variante="secundario" disabled={pendienteNo}>
            {pendienteNo ? "Guardando…" : "No, no está alquilada"}
          </Boton>
        </form>
      )}
      <Desplegable textoBoton={yaConfirmado || estadoNo?.ok ? "Cargar inquilino" : "Sí, cargar al inquilino"}>
        {() => (
          <>
            <p className="text-pizarra-suave">
              Con el mail del inquilino le creamos un usuario y le mandamos una invitación para que entre al sistema.
            </p>
            <FormPersona accion={altaInquilino} textoBoton="Cargar inquilino" />
          </>
        )}
      </Desplegable>
    </div>
  );
}

export function DarDeBaja({
  accion,
  propia,
  nombre,
  codigoP,
}: {
  accion: AccionSimple;
  propia: boolean;
  nombre: string;
  codigoP: string;
}) {
  return (
    <AccionConfirmada
      accion={accion}
      textoBoton={propia ? "Darme de baja como inquilino" : "Dar de baja al inquilino"}
      textoConfirmar={propia ? "Sí, darme de baja" : "Sí, dar de baja"}
      explicacion={
        propia ? (
          <p>
            Vas a dejar de figurar como inquilino de esta unidad y ya no vas a poder entrar a ella en el
            sistema. Los gastos comunes vuelven a quedar a nombre del propietario.
          </p>
        ) : (
          <p>
            {nombre} deja de figurar como inquilino y pierde el acceso al sistema para esta unidad. En la
            liquidación la unidad vuelve a figurar con código A; el saldo pendiente queda en {codigoP}.
          </p>
        )
      }
    />
  );
}

export function ReenviarInvitacion({ accion }: { accion: AccionSimple }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  return (
    <form action={enviar} className="flex flex-col gap-2">
      <MensajeEstado estado={estado} />
      {!estado?.ok && (
        <button type="submit" disabled={pendiente} className="min-h-11 self-start py-2 font-bold underline underline-offset-4 hover:text-bronce">
          {pendiente ? "Enviando…" : "Reenviar invitación"}
        </button>
      )}
    </form>
  );
}

export function AgregarDestinatario({ accion }: { accion: AccionForm }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const err = estado && !estado.ok ? estado.campos ?? {} : {};
  return (
    <Desplegable textoBoton="Agregar un mail">
      {() => (
        <form action={enviar} className="flex flex-col gap-4" noValidate key={estado?.ok ? "ok" : "form"}>
          <MensajeEstado estado={estado} />
          <Campo etiqueta="Mail" name="email" type="email" inputMode="email" autoComplete="email" error={err.email} required />
          <Campo etiqueta="Nombre (opcional)" name="nombre" error={err.nombre} />
          <Boton type="submit" disabled={pendiente} className="self-start">
            {pendiente ? "Agregando…" : "Agregar mail"}
          </Boton>
        </form>
      )}
    </Desplegable>
  );
}

export function QuitarDestinatario({ accion, email }: { accion: AccionSimple; email: string }) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  return (
    <form action={enviar}>
      {estado && !estado.ok && <MensajeEstado estado={estado} />}
      <button
        type="submit"
        disabled={pendiente}
        aria-label={`Quitar ${email}`}
        className="min-h-11 px-2 font-bold text-alerta underline underline-offset-4"
      >
        {pendiente ? "Quitando…" : "Quitar"}
      </button>
    </form>
  );
}

export function CambiarPropietario({ accion }: { accion: AccionForm }) {
  return (
    <Desplegable textoBoton="Cambiar de propietario">
      {() => (
        <>
          <p className="text-pizarra-suave">
            Usalo cuando se vende la unidad. El responsable actual deja de figurar y entra el nuevo. Si hay
            inquilino, sigue cargado.
          </p>
          <FormPersona accion={accion} conCalidad textoBoton="Guardar nuevo propietario" />
        </>
      )}
    </Desplegable>
  );
}
