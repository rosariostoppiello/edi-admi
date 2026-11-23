"use client";
/**
 * Formularios de la confección de la liquidación. Reciben server actions ya
 * atadas (bind) a la liquidación; el servidor vuelve a validar todo.
 */
import { startTransition, useActionState, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo, Casilla, Selector } from "@/componentes/ui/campo";
import { AccionConfirmada, Desplegable, MensajeEstado, useAvisar, type Estado } from "@/componentes/ui/formularios";
import { formatearNumero, parsearMonto, type Centesimos } from "@/dominio/dinero";
import type { Disponibilidades } from "@/dominio/liquidacion/disponibilidades";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;
type AccionSimple = (estado: Estado) => Promise<Estado>;
type Errores = Partial<Record<string, string>>;

/**
 * Formulario que conserva lo escrito si hay un error y se limpia cuando sale bien.
 * (Con `action={...}` React limpia el formulario siempre, aun con errores.)
 */
function FormAccion({
  accion,
  children,
  className = "flex flex-col gap-4",
  limpiar = true,
}: {
  accion: AccionForm;
  children: (err: Errores, pendiente: boolean) => ReactNode;
  className?: string;
  limpiar?: boolean;
}) {
  const avisar = useAvisar();
  const [estado, enviar, pendiente] = useActionState(async (prev: Estado, fd: FormData) => {
    const r = await accion(prev, fd);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok && limpiar) ref.current?.reset();
  }, [estado, limpiar]);
  const err = estado && !estado.ok ? (estado.campos ?? {}) : {};
  return (
    <form
      ref={ref}
      noValidate
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => enviar(fd));
      }}
    >
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      {children(err, pendiente)}
    </form>
  );
}

function Enviar({ pendiente, texto, enviando = "Guardando…" }: { pendiente: boolean; texto: string; enviando?: string }) {
  return (
    <Boton type="submit" disabled={pendiente} className="self-start">
      {pendiente ? enviando : texto}
    </Boton>
  );
}

/** Lista de códigos para autocompletar (2-201-A…). */
function ListaCodigos({ id, codigos }: { id: string; codigos: string[] }) {
  return (
    <datalist id={id}>
      {codigos.map((c) => (
        <option key={c} value={c} />
      ))}
    </datalist>
  );
}

function CampoCodigo({ codigos, error, etiqueta = "Unidad" }: { codigos: string[]; error?: string; etiqueta?: string }) {
  const id = useId();
  return (
    <>
      <Campo
        etiqueta={etiqueta}
        name="codigo"
        list={id}
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="2-201-A"
        ayuda="Código completo, con A, P o I"
        error={error}
        required
      />
      <ListaCodigos id={id} codigos={codigos} />
    </>
  );
}

const ayudaMonto = "Ej. 12.500,00";

// ---------------------------------------------------------------------------

export function FormIngreso({ accion, codigos, fechaSugerida }: { accion: AccionForm; codigos: string[]; fechaSugerida: string }) {
  return (
    <FormAccion accion={accion}>
      {(err, pendiente) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CampoCodigo codigos={codigos} error={err.codigo} />
            <Campo etiqueta="Fecha del pago" name="fecha" type="date" defaultValue={fechaSugerida} error={err.fecha} required />
            <Campo etiqueta="Monto" name="monto" inputMode="decimal" ayuda={ayudaMonto} error={err.monto} required />
            <Campo etiqueta="Referencia (opcional)" name="referencia" ayuda="Nro. de depósito o transferencia" error={err.referencia} />
          </div>
          <Enviar pendiente={pendiente} texto="Cargar pago" />
        </>
      )}
    </FormAccion>
  );
}

export function FormPlanilla({ accion, texto }: { accion: AccionForm; texto: string }) {
  return (
    <FormAccion accion={accion} className="flex flex-col gap-4">
      {(_, pendiente) => (
        <>
          <Campo
            etiqueta="Planilla"
            name="archivo"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            ayuda="Excel (.xlsx) o CSV, hasta 3 MB"
            className="[&_input]:py-2.5"
            required
          />
          <Enviar pendiente={pendiente} texto={texto} enviando="Leyendo la planilla…" />
        </>
      )}
    </FormAccion>
  );
}

export function FormDeposito({ accion, fechaSugerida }: { accion: AccionForm; fechaSugerida: string }) {
  return (
    <FormAccion accion={accion}>
      {(err, pendiente) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Fecha de cobro" name="fecha" type="date" defaultValue={fechaSugerida} error={err.fecha} required />
            <Campo etiqueta="Forma de pago" name="forma" defaultValue="Depósito" error={err.forma} required />
            <Campo etiqueta="Nro. de documento (opcional)" name="documento" error={err.documento} />
            <Campo etiqueta="Monto" name="monto" inputMode="decimal" ayuda={ayudaMonto} error={err.monto} required />
          </div>
          <Enviar pendiente={pendiente} texto="Cargar depósito" />
        </>
      )}
    </FormAccion>
  );
}

export function FormIdentificar({ accion, codigos }: { accion: AccionForm; codigos: string[] }) {
  return (
    <FormAccion accion={accion} className="grid items-start gap-3 sm:grid-cols-[minmax(0,28rem)_auto]">
      {(err, pendiente) => (
        <>
          <div>
            <CampoCodigo codigos={codigos} error={err.codigo} etiqueta="¿De qué unidad es?" />
          </div>
          {/* Alineado con el campo, no con la etiqueta. */}
          <div className="sm:mt-[33px]">
            <Enviar pendiente={pendiente} texto="Asignar" enviando="Asignando…" />
          </div>
        </>
      )}
    </FormAccion>
  );
}

export interface OpcionRubro {
  id: string;
  codigo: string;
  nombre: string;
  grupo: string;
}

function SelectorRubro({ rubros, error, defaultValue }: { rubros: OpcionRubro[]; error?: string; defaultValue?: string }) {
  const grupos = [...new Set(rubros.map((r) => r.grupo))];
  return (
    <Selector etiqueta="Rubro" name="rubroId" defaultValue={defaultValue ?? ""} error={error} required>
      <option value="" disabled>
        Elegí el rubro
      </option>
      {grupos.map((g) => (
        <optgroup key={g} label={g}>
          {rubros
            .filter((r) => r.grupo === g)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.codigo} {r.nombre}
              </option>
            ))}
        </optgroup>
      ))}
    </Selector>
  );
}

interface ValoresEgreso {
  rubroId?: string;
  fecha?: string;
  proveedor?: string;
  detalle?: string;
  monto?: string;
}

function CamposEgreso({ err, rubros, proveedores, valores = {} }: { err: Errores; rubros: OpcionRubro[]; proveedores: string[]; valores?: ValoresEgreso }) {
  const id = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SelectorRubro rubros={rubros} error={err.rubroId} defaultValue={valores.rubroId} />
      <Campo etiqueta="Fecha de pago" name="fecha" type="date" defaultValue={valores.fecha} error={err.fecha} required />
      <Campo etiqueta="Proveedor o ente" name="proveedor" list={id} defaultValue={valores.proveedor} error={err.proveedor} required />
      <datalist id={id}>
        {proveedores.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <Campo etiqueta="Período o detalle" name="detalle" defaultValue={valores.detalle} ayuda="Ej. Setiembre 2026" error={err.detalle} required />
      <Campo etiqueta="Monto" name="monto" inputMode="decimal" defaultValue={valores.monto} ayuda={ayudaMonto} error={err.monto} required />
    </div>
  );
}

export function FormEgreso({
  accion,
  rubros,
  proveedores,
  fechaSugerida,
  detalleSugerido,
}: {
  accion: AccionForm;
  rubros: OpcionRubro[];
  proveedores: string[];
  fechaSugerida: string;
  detalleSugerido: string;
}) {
  return (
    <FormAccion accion={accion}>
      {(err, pendiente) => (
        <>
          <CamposEgreso err={err} rubros={rubros} proveedores={proveedores} valores={{ fecha: fechaSugerida, detalle: detalleSugerido }} />
          <Casilla name="fijo" etiqueta="Se repite todos los meses" ayuda="Se precarga en las próximas liquidaciones con este monto, para revisar." />
          <Enviar pendiente={pendiente} texto="Cargar egreso" />
        </>
      )}
    </FormAccion>
  );
}

export function EditarEgreso({
  accion,
  rubros,
  proveedores,
  valores,
}: {
  accion: AccionForm;
  rubros: OpcionRubro[];
  proveedores: string[];
  valores: ValoresEgreso;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="min-h-11 px-2 font-bold underline underline-offset-4 hover:text-bronce">
        Editar
      </button>
    );
  }
  return (
    <div className="mt-3 w-full rounded-[var(--radius-campo)] border-2 border-junta-fuerte bg-granito p-4">
      <FormAccion accion={accion} limpiar={false}>
        {(err, pendiente) => (
          <>
            <CamposEgreso err={err} rubros={rubros} proveedores={proveedores} valores={valores} />
            <div className="flex flex-wrap gap-3">
              <Enviar pendiente={pendiente} texto="Guardar egreso" />
              <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>
                Cerrar
              </Boton>
            </div>
          </>
        )}
      </FormAccion>
    </div>
  );
}

export function FormRubro({ accion }: { accion: AccionForm }) {
  return (
    <FormAccion accion={accion}>
      {(err, pendiente) => (
        <>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Campo etiqueta="Código" name="codigo" inputMode="decimal" ayuda="Ej. 4 o 4.12" error={err.codigo} required />
            <Campo etiqueta="Nombre" name="nombre" error={err.nombre} required />
          </div>
          <Casilla name="cargoPropietario" etiqueta="Es de cargo de los propietarios" ayuda="Como el seguro: en unidades alquiladas lo paga el propietario." />
          <Enviar pendiente={pendiente} texto="Agregar rubro" />
        </>
      )}
    </FormAccion>
  );
}

export function AgregarRubro({ accion }: { accion: AccionForm }) {
  return <Desplegable textoBoton="Agregar un rubro">{() => <FormRubro accion={accion} />}</Desplegable>;
}

export const TIPOS_CARGO = {
  BARBACOAS: "Barbacoas",
  OTROS: "Otros (tag de garaje, ajustes, bonificaciones)",
  MULTA: "Multa",
} as const;

export function FormCargo({ accion, codigos }: { accion: AccionForm; codigos: string[] }) {
  return (
    <FormAccion accion={accion}>
      {(err, pendiente) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CampoCodigo codigos={codigos} error={err.codigo} />
            <Selector etiqueta="Tipo de cargo" name="tipo" defaultValue="BARBACOA_OTROS" error={err.tipo}>
              {Object.entries(TIPOS_CARGO).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </Selector>
            <Campo etiqueta="Concepto" name="concepto" ayuda="Lo ve la unidad. Ej. Barbacoa Sky 12/10" error={err.concepto} required />
            <Campo etiqueta="Monto" name="monto" inputMode="decimal" ayuda="Negativo solo para bonificar" error={err.monto} required />
          </div>
          <Enviar pendiente={pendiente} texto="Cargar" />
        </>
      )}
    </FormAccion>
  );
}

const montoTexto = (c: number) => formatearNumero(c as Centesimos);

export function FilaCuotas({
  accion,
  codigo,
  descripcion,
  valores,
}: {
  accion: AccionForm;
  codigo: string;
  descripcion: string;
  valores: { gcUnidad: number; gcPropietario: number; gcGaraje: number; cuotaExtraFr: number; garajeACargoDe: string; arrendada: boolean };
}) {
  return (
    <FormAccion accion={accion} limpiar={false} className="flex flex-col gap-3 py-4">
      {(err, pendiente) => (
        <>
          <p>
            <span className="font-mono font-bold">{codigo}</span> <span className="text-pizarra-suave">{descripcion}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
            <Campo etiqueta="Gasto común" name="gcUnidad" inputMode="decimal" defaultValue={montoTexto(valores.gcUnidad)} error={err.gcUnidad} />
            <Campo etiqueta="Parte del propietario" name="gcPropietario" inputMode="decimal" defaultValue={montoTexto(valores.gcPropietario)} error={err.gcPropietario} />
            <Campo etiqueta="Garaje" name="gcGaraje" inputMode="decimal" defaultValue={montoTexto(valores.gcGaraje)} error={err.gcGaraje} />
            <Campo etiqueta="Cuota extra F.R." name="cuotaExtraFr" inputMode="decimal" defaultValue={montoTexto(valores.cuotaExtraFr)} error={err.cuotaExtraFr} />
            <Selector etiqueta="Garaje lo paga" name="garajeACargoDe" defaultValue={valores.garajeACargoDe} disabled={!valores.arrendada}>
              <option value="INQUILINO">El inquilino</option>
              <option value="PROPIETARIO">El propietario</option>
            </Selector>
            {!valores.arrendada && <input type="hidden" name="garajeACargoDe" value={valores.garajeACargoDe} />}
            <Enviar pendiente={pendiente} texto="Guardar" />
          </div>
        </>
      )}
    </FormAccion>
  );
}

export function FormParametros({
  accion,
  valores,
}: {
  accion: AccionForm;
  valores: { tasaInteres: string; tasaFondoReserva: string; diaVencimiento: number; procedimientoPago: string };
}) {
  return (
    <FormAccion accion={accion} limpiar={false}>
      {(err, pendiente) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Interés por mora (%)" name="tasaInteres" inputMode="decimal" defaultValue={valores.tasaInteres} ayuda="Sobre el saldo impago" error={err.tasaInteres} />
            <Campo etiqueta="Fondo de reserva (%)" name="tasaFondoReserva" inputMode="decimal" defaultValue={valores.tasaFondoReserva} ayuda="Sobre GC unidad + garaje" error={err.tasaFondoReserva} />
            <Campo etiqueta="Día de vencimiento" name="diaVencimiento" type="number" min={1} max={28} defaultValue={valores.diaVencimiento} ayuda="Del mes siguiente" error={err.diaVencimiento} />
          </div>
          <AreaTexto
            etiqueta="Procedimiento de pago"
            name="procedimientoPago"
            rows={7}
            defaultValue={valores.procedimientoPago}
            ayuda="Cuenta bancaria, cómo indicar la unidad y recargos. Separá los párrafos con una línea en blanco."
            error={err.procedimientoPago}
          />
          <Casilla name="guardarComoPredeterminado" etiqueta="Usar estos valores también en los meses siguientes" />
          <Enviar pendiente={pendiente} texto="Guardar parámetros" />
        </>
      )}
    </FormAccion>
  );
}

// ---------------------------------------------------------------------------
// Disponibilidades: editor con estado local que se manda como JSON.
// ---------------------------------------------------------------------------

/** Campo de monto que guarda el texto y valida al salir. */
function CampoMonto({ etiqueta, valor, alCambiar, ayuda }: { etiqueta: string; valor: number; alCambiar: (c: number) => void; ayuda?: string }) {
  const [texto, setTexto] = useState(montoTexto(valor));
  const [error, setError] = useState<string>();
  return (
    <Campo
      etiqueta={etiqueta}
      inputMode="decimal"
      value={texto}
      ayuda={ayuda}
      error={error}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        try {
          const c = parsearMonto(texto || "0");
          setError(undefined);
          setTexto(montoTexto(c));
          alCambiar(c);
        } catch {
          setError("Escribilo como 1.234,50");
        }
      }}
    />
  );
}

export function EditorDisponibilidades({ accion, inicial }: { accion: AccionForm; inicial: Disponibilidades }) {
  const [d, setD] = useState<Disponibilidades>(inicial);
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const setOtra = (i: number, cambio: Partial<Disponibilidades["otras"][number]>) =>
    setD((x) => ({ ...x, otras: x.otras.map((o, j) => (j === i ? { ...o, ...cambio } : o)) }));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("datos", JSON.stringify(d));
        startTransition(() => enviar(fd));
      }}
    >
      <MensajeEstado estado={estado} />
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-medio font-bold">Cuenta corriente en pesos</legend>
        <Campo etiqueta="Nombre de la cuenta" value={d.nombreCuenta} onChange={(e) => setD({ ...d, nombreCuenta: e.target.value })} />
        <p className="text-pizarra-suave">Saldo inicial del mes (se completa solo con el saldo final del mes anterior).</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoMonto etiqueta="Fondo gastos comunes" valor={d.saldoInicial.gc} alCambiar={(gc) => setD((x) => ({ ...x, saldoInicial: { ...x.saldoInicial, gc } }))} />
          <CampoMonto etiqueta="Fondo de reserva" valor={d.saldoInicial.fr} alCambiar={(fr) => setD((x) => ({ ...x, saldoInicial: { ...x.saldoInicial, fr } }))} />
          <CampoMonto etiqueta="Depósitos no identificados" valor={d.saldoInicial.dni} alCambiar={(dni) => setD((x) => ({ ...x, saldoInicial: { ...x.saldoInicial, dni } }))} />
        </div>
        <CampoMonto
          etiqueta="Parte de los ingresos del mes que va al fondo de reserva"
          valor={d.ingresosFondoReserva}
          alCambiar={(ingresosFondoReserva) => setD((x) => ({ ...x, ingresosFondoReserva }))}
          ayuda="El resto de los pagos va al fondo de gastos comunes."
        />
      </fieldset>

      {d.otras.map((o, i) => (
        <fieldset key={i} className="flex flex-col gap-4 border-t border-junta pt-5">
          <legend className="sr-only">{o.nombre}</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem_1fr]">
            <Campo etiqueta="Cuenta" value={o.nombre} onChange={(e) => setOtra(i, { nombre: e.target.value })} />
            <Selector etiqueta="Moneda" value={o.moneda} onChange={(e) => setOtra(i, { moneda: e.target.value as "UYU" | "USD" })}>
              <option value="UYU">Pesos</option>
              <option value="USD">Dólares</option>
            </Selector>
            <CampoMonto etiqueta="Saldo inicial" valor={o.saldoInicial} alCambiar={(saldoInicial) => setOtra(i, { saldoInicial })} />
          </div>
          {o.movimientos.map((m, k) => (
            <div key={k} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
              <Campo
                etiqueta="Movimiento"
                value={m.concepto}
                onChange={(e) => setOtra(i, { movimientos: o.movimientos.map((x, j) => (j === k ? { ...x, concepto: e.target.value } : x)) })}
              />
              <CampoMonto
                etiqueta="Monto"
                valor={m.monto}
                ayuda="Negativo si es egreso"
                alCambiar={(monto) => setOtra(i, { movimientos: o.movimientos.map((x, j) => (j === k ? { ...x, monto } : x)) })}
              />
              <Boton type="button" variante="texto" onClick={() => setOtra(i, { movimientos: o.movimientos.filter((_, j) => j !== k) })}>
                Quitar
              </Boton>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <Boton type="button" variante="secundario" onClick={() => setOtra(i, { movimientos: [...o.movimientos, { concepto: "", monto: 0 }] })}>
              Agregar movimiento
            </Boton>
            <Boton type="button" variante="texto" onClick={() => setD((x) => ({ ...x, otras: x.otras.filter((_, j) => j !== i) }))}>
              Quitar cuenta
            </Boton>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-3 border-t border-junta pt-5">
        <Boton
          type="button"
          variante="secundario"
          onClick={() => setD((x) => ({ ...x, otras: [...x.otras, { nombre: "Caja chica", moneda: "UYU", saldoInicial: 0, movimientos: [] }] }))}
        >
          Agregar otra cuenta
        </Boton>
        <Boton type="submit" disabled={pendiente}>
          {pendiente ? "Guardando…" : "Guardar disponibilidades"}
        </Boton>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Botones de acción
// ---------------------------------------------------------------------------

/** Ejecuta la acción y, si sale bien, deja el mensaje en la zona de avisos de la sección. */
function useAccionConAviso(accion: AccionSimple) {
  const avisar = useAvisar();
  const [estado, enviar, pendiente] = useActionState(async (prev: Estado) => {
    const r = await accion(prev);
    if (r?.ok) avisar?.(r.mensaje);
    return r;
  }, null);
  return { estado, enviar, pendiente, avisar };
}

export function BotonQuitar({ accion, etiqueta, texto = "Quitar" }: { accion: AccionSimple; etiqueta: string; texto?: string }) {
  const { estado, enviar, pendiente } = useAccionConAviso(accion);
  return (
    <form action={enviar} className="flex flex-col items-end">
      {estado && !estado.ok && <MensajeEstado estado={estado} />}
      <button type="submit" disabled={pendiente} aria-label={etiqueta} className="min-h-11 px-2 font-bold text-alerta underline underline-offset-4">
        {pendiente ? "Un momento…" : texto}
      </button>
    </form>
  );
}

export function BotonAccion({ accion, texto, variante = "primario" }: { accion: AccionSimple; texto: string; variante?: "primario" | "secundario" }) {
  const { estado, enviar, pendiente, avisar } = useAccionConAviso(accion);
  return (
    <form action={enviar} className="flex flex-col gap-3">
      {!(avisar && estado?.ok) && <MensajeEstado estado={estado} />}
      <Boton type="submit" variante={variante} disabled={pendiente} className="self-start">
        {pendiente ? "Un momento…" : texto}
      </Boton>
    </form>
  );
}

export function Publicar({ accion, explicacion }: { accion: AccionSimple; explicacion: ReactNode }) {
  return (
    <AccionConfirmada
      accion={accion}
      variante="primario"
      textoBoton="Publicar liquidación"
      textoConfirmar="Sí, publicar y enviar"
      explicacion={explicacion}
    />
  );
}

export function EliminarBorrador({ accion }: { accion: AccionSimple }) {
  return (
    <AccionConfirmada
      accion={accion}
      textoBoton="Eliminar borrador"
      textoConfirmar="Sí, eliminar"
      explicacion={<p>Se borra todo lo cargado en este borrador (pagos, egresos, cargos y depósitos). No se puede deshacer.</p>}
    />
  );
}

export function Anular({ accion }: { accion: AccionForm }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return (
      <Boton type="button" variante="secundario" className="self-start" onClick={() => setAbierto(true)}>
        Anular y corregir
      </Boton>
    );
  }
  return (
    <div className="rounded-[var(--radius-campo)] border-2 border-alerta bg-losa p-4">
      <FormAccion accion={accion} limpiar={false}>
        {(err, pendiente) => (
          <>
            <p>
              La liquidación queda <strong>anulada</strong> (se guarda como historia, con el motivo) y se abre una copia en borrador para
              corregirla. Al publicarla de nuevo, se envía a todos como <strong>rectificada</strong>.
            </p>
            <AreaTexto etiqueta="Motivo de la anulación" name="motivo" rows={3} error={err.motivo} required />
            <div className="flex flex-wrap gap-3">
              <Boton type="submit" variante="peligro" disabled={pendiente}>
                {pendiente ? "Anulando…" : "Sí, anular y corregir"}
              </Boton>
              <Boton type="button" variante="secundario" onClick={() => setAbierto(false)} disabled={pendiente}>
                Cancelar
              </Boton>
            </div>
          </>
        )}
      </FormAccion>
    </div>
  );
}
