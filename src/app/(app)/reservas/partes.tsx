"use client";
/**
 * Partes interactivas de Reservas. Reciben server actions ya atadas (bind);
 * el servidor vuelve a validar permisos y reglas.
 */
import { useState } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, CampoCodigo, Casilla, Selector } from "@/componentes/ui/campo";
import { AccionConfirmada, MensajeEstado, useEnvioConservado, type Estado } from "@/componentes/ui/formularios";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;
type AccionSimple = (estado: Estado) => Promise<Estado>;

export function CancelarReserva({ accion, descripcion, fueraDePlazo }: { accion: AccionSimple; descripcion: string; fueraDePlazo: boolean }) {
  return (
    <AccionConfirmada
      accion={accion}
      textoBoton="Cancelar la reserva"
      textoConfirmar="Sí, cancelar la reserva"
      explicacion={
        <p>
          Vas a cancelar {descripcion}. El turno queda libre para otra unidad.
          {fueraDePlazo && " Faltan menos de 48 horas: como Administración, podés cancelarla igual."}
        </p>
      }
    />
  );
}

export function FormReservar({
  accion,
  espacioId,
  fecha,
  turno,
  codigos,
  pideCodigo,
  pidePedidaPor,
}: {
  accion: AccionForm;
  espacioId: string;
  fecha: string;
  turno: string;
  codigos: string[];
  pideCodigo: boolean;
  pidePedidaPor: boolean;
}) {
  const { estado, alEnviar, pendiente, errores: err } = useEnvioConservado(accion);
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <MensajeEstado estado={estado} />
      <input type="hidden" name="espacioId" value={espacioId} />
      <input type="hidden" name="fecha" value={fecha} />
      <input type="hidden" name="turno" value={turno} />
      {pideCodigo && (
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoCodigo codigos={codigos} error={err.codigo} etiqueta="Unidad que reserva" ayuda="Código de la línea que paga la barbacoa: A, P o I" />
          <Campo
            etiqueta={pidePedidaPor ? "Quién lo pidió" : "Quién lo pidió (opcional)"}
            name="pedidaPor"
            autoComplete="off"
            ayuda="Nombre de la persona de la unidad"
            error={err.pedidaPor}
            required={pidePedidaPor}
          />
        </div>
      )}
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Reservando…" : "Confirmar la reserva"}
      </Boton>
    </form>
  );
}

export interface ValoresEspacio {
  nombre: string;
  tipo: string;
  tarifa: string;
  descripcion: string;
  activo: boolean;
  anticipacionDias: number;
  maxActivasPorUnidad: number;
  horasCancelacion: number;
}

export function FormEspacio({ accion, valores }: { accion: AccionForm; valores: ValoresEspacio }) {
  const { estado, alEnviar, pendiente, errores: err } = useEnvioConservado(accion);
  const esBarbacoa = valores.tipo === "BARBACOA";
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate>
      <MensajeEstado estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={valores.nombre} error={err.nombre} required />
        {esBarbacoa ? (
          <Campo etiqueta="Tarifa por turno" name="tarifa" inputMode="decimal" defaultValue={valores.tarifa} ayuda="Se cobra en la liquidación. Ej. 800,00" error={err.tarifa} required />
        ) : (
          <input type="hidden" name="tarifa" value="0" />
        )}
      </div>
      {esBarbacoa ? (
        <fieldset className="grid gap-4 sm:grid-cols-3">
          <legend className="mb-2 font-bold">Reglas de reserva</legend>
          <Campo etiqueta="Anticipación máxima (días)" name="anticipacionDias" inputMode="numeric" defaultValue={valores.anticipacionDias} error={err.anticipacionDias} required />
          <Campo etiqueta="Reservas activas por unidad" name="maxActivasPorUnidad" inputMode="numeric" defaultValue={valores.maxActivasPorUnidad} error={err.maxActivasPorUnidad} required />
          <Campo etiqueta="Cancelar hasta (horas antes)" name="horasCancelacion" inputMode="numeric" defaultValue={valores.horasCancelacion} error={err.horasCancelacion} required />
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="anticipacionDias" value={valores.anticipacionDias} />
          <input type="hidden" name="maxActivasPorUnidad" value={valores.maxActivasPorUnidad} />
          <input type="hidden" name="horasCancelacion" value={valores.horasCancelacion} />
        </>
      )}
      {valores.tipo === "LAUNDRY" || valores.tipo === "PISCINA" ? (
        <AreaTexto etiqueta="Cómo funciona (lo ven todos)" name="descripcion" rows={5} defaultValue={valores.descripcion} error={err.descripcion} />
      ) : (
        <input type="hidden" name="descripcion" value={valores.descripcion} />
      )}
      <Casilla etiqueta="Activo" name="activo" defaultChecked={valores.activo} ayuda="Si lo desactivás, deja de aparecer para reservar. Las reservas hechas siguen en pie." />
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </Boton>
    </form>
  );
}

export function FormNuevoEspacio({
  accion,
  torres,
  barbacoasSinSolarium,
}: {
  accion: AccionForm;
  torres: { codigo: number; numero: number; nombre: string }[];
  barbacoasSinSolarium: { id: string; nombre: string }[];
}) {
  const { estado, alEnviar, pendiente, errores: err } = useEnvioConservado(accion);
  const [tipo, setTipo] = useState("BARBACOA");
  return (
    <form onSubmit={alEnviar} className="flex flex-col gap-4" noValidate key={estado?.ok ? "ok" : "form"}>
      <MensajeEstado estado={estado} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Tipo" name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} error={err.tipo}>
          <option value="BARBACOA">Barbacoa (se reserva)</option>
          <option value="SOLARIUM">Solarium (atado a una barbacoa)</option>
          <option value="PISCINA">Piscina (informativa: horarios y reglas)</option>
          <option value="OTRO">Otro espacio</option>
        </Selector>
        <Campo etiqueta="Nombre" name="nombre" placeholder={tipo === "SOLARIUM" ? "Solarium Torre …" : "Barbacoa Torre …"} error={err.nombre} required />
        <Selector etiqueta="Torre (opcional)" name="torreId" defaultValue="" error={err.torreId}>
          <option value="">Sin torre</option>
          {torres.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.numero} {t.nombre}
            </option>
          ))}
        </Selector>
        {tipo === "SOLARIUM" && (
          <Selector etiqueta="Barbacoa" name="barbacoaId" defaultValue="" error={err.barbacoaId}>
            <option value="">Elegí la barbacoa</option>
            {barbacoasSinSolarium.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Selector>
        )}
        {tipo === "BARBACOA" ? (
          <Campo etiqueta="Tarifa por turno" name="tarifa" inputMode="decimal" ayuda="Ej. 800,00" error={err.tarifa} required />
        ) : (
          <input type="hidden" name="tarifa" value="0" />
        )}
      </div>
      <Boton type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Agregando…" : "Agregar espacio"}
      </Boton>
    </form>
  );
}
