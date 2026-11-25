"use client";
/** Formulario del botón de emergencia. El servidor vuelve a validar todo. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Aviso } from "@/componentes/ui/aviso";
import { Boton } from "@/componentes/ui/boton";
import { AreaTexto, Campo } from "@/componentes/ui/campo";
import {
  MensajeEstado,
  useEnvioConservado,
  type Estado,
} from "@/componentes/ui/formularios";
import { IconoLlamar } from "@/componentes/ui/iconos";
import {
  CONSEJO,
  NOMBRE_TIPO,
  NUMEROS_EMERGENCIA,
  TIPOS_EMERGENCIA,
  type TipoEmergencia,
} from "@/dominio/emergencias";

type AccionForm = (estado: Estado, fd: FormData) => Promise<Estado>;

const MANTENER_MS = 2000;

/** Enlace que llama directo desde el celular. */
function Llamar({
  numero,
  nombre,
  fuerte = false,
}: {
  numero: string;
  nombre: string;
  fuerte?: boolean;
}) {
  return (
    <a
      href={`tel:${numero}`}
      className={`inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-campo)] px-4 font-bold ${
        fuerte
          ? "bg-alerta text-white hover:brightness-90"
          : "border-2 border-pizarra bg-losa text-pizarra hover:bg-granito"
      }`}
    >
      <IconoLlamar className="size-5 shrink-0" />
      {nombre} <span className="font-mono">{numero}</span>
    </a>
  );
}

function Llamadas({
  telefonos,
}: {
  telefonos: { porteria: string | null; administracion: string | null };
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {NUMEROS_EMERGENCIA.map((n, i) => (
        <Llamar
          key={n.numero}
          numero={n.numero}
          nombre={n.nombre}
          fuerte={i === 0}
        />
      ))}
      {telefonos.porteria && (
        <Llamar numero={telefonos.porteria} nombre="Portería" />
      )}
      {telefonos.administracion && (
        <Llamar numero={telefonos.administracion} nombre="Administración" />
      )}
    </div>
  );
}

/**
 * Botón que hay que mantener apretado (con el dedo, el mouse o la barra espaciadora)
 * para confirmar. Evita que el aviso salga por un toque sin querer.
 */
function BotonMantener({
  alConfirmar,
  deshabilitado,
  children,
}: {
  alConfirmar: () => void;
  deshabilitado: boolean;
  children: string;
}) {
  const [inicio, setInicio] = useState<number | null>(null);
  const [progreso, setProgreso] = useState(0);
  const cuadro = useRef<number | null>(null);
  const confirmar = useRef(alConfirmar);
  useEffect(() => {
    confirmar.current = alConfirmar;
  });

  useEffect(() => {
    if (inicio === null) return;
    const avanzar = () => {
      const p = Math.min(1, (performance.now() - inicio) / MANTENER_MS);
      setProgreso(p);
      if (p >= 1) {
        setInicio(null);
        confirmar.current();
        return;
      }
      cuadro.current = requestAnimationFrame(avanzar);
    };
    cuadro.current = requestAnimationFrame(avanzar);
    return () => {
      if (cuadro.current) cancelAnimationFrame(cuadro.current);
    };
  }, [inicio]);

  const empezar = () => {
    if (!deshabilitado && inicio === null) setInicio(performance.now());
  };
  const soltar = () => {
    if (inicio !== null) {
      setInicio(null);
      setProgreso(0);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={deshabilitado}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          empezar();
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            empezar();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") soltar();
        }}
        onBlur={soltar}
        onContextMenu={(e) => e.preventDefault()}
        aria-describedby="como-confirmar"
        style={{ WebkitTouchCallout: "none" }}
        className="relative min-h-16 select-none overflow-hidden rounded-[var(--radius-campo)] bg-alerta px-5 text-medio font-bold text-white disabled:opacity-60"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-black/25"
          style={{ width: `${progreso * 100}%` }}
        />
        <span className="relative">
          {progreso > 0 ? "Seguí apretando…" : children}
        </span>
      </button>
      <p id="como-confirmar" className="text-chico text-pizarra-suave">
        Mantené apretado el botón 2 segundos (con el teclado, la barra
        espaciadora). Si lo soltás antes, no se manda.
      </p>
    </div>
  );
}

export function FormEmergencia({
  accion,
  telefonos,
}: {
  accion: AccionForm;
  telefonos: { porteria: string | null; administracion: string | null };
}) {
  const { estado, alEnviar, pendiente, errores } = useEnvioConservado(accion);
  const [paso, setPaso] = useState<"datos" | "confirmar">("datos");
  const [tipo, setTipo] = useState<TipoEmergencia | null>(null);
  const [faltaTipo, setFaltaTipo] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (paso === "confirmar") titulo.current?.focus();
  }, [paso]);

  if (estado?.ok) {
    return (
      <div className="flex flex-col gap-5">
        <Aviso tono="ok">{estado.mensaje}</Aviso>
        {tipo && CONSEJO[tipo] && (
          <p className="text-medio font-bold">{CONSEJO[tipo]}</p>
        )}
        <Llamadas telefonos={telefonos} />
        <Link
          href="/inicio"
          className="self-start py-2 underline underline-offset-4 hover:text-bronce"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={form}
      onSubmit={alEnviar}
      className="flex flex-col gap-6"
      noValidate
    >
      <section
        aria-labelledby="llamar"
        className="flex flex-col gap-3 rounded-[var(--radius-tecla)] border-2 border-alerta bg-alerta-fondo p-4 md:p-6"
      >
        <h2 id="llamar" className="text-titulo font-bold text-alerta">
          ¿Ya llamaste al 911?
        </h2>
        <p>
          Si hay peligro, llamá primero. Este aviso le llega al edificio, pero
          no reemplaza a los servicios de emergencia.
        </p>
        <Llamadas telefonos={telefonos} />
      </section>

      <MensajeEstado estado={estado} />

      <div hidden={paso !== "datos"} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-titulo font-bold">
            ¿Qué está pasando?
          </legend>
          {TIPOS_EMERGENCIA.map((t) => (
            <label key={t} className="flex min-h-12 items-center gap-3">
              <input
                type="radio"
                name="tipo"
                value={t}
                checked={tipo === t}
                onChange={() => {
                  setTipo(t);
                  setFaltaTipo(false);
                }}
                className="size-5 shrink-0 accent-[var(--alerta)]"
              />
              {NOMBRE_TIPO[t]}
            </label>
          ))}
          {(faltaTipo || errores.tipo) && (
            <p className="text-chico font-bold text-alerta">
              {errores.tipo ?? "Elegí qué está pasando."}
            </p>
          )}
        </fieldset>
        <Campo
          etiqueta="¿Dónde? (opcional)"
          name="lugar"
          ayuda="Ej. Torre 2, piso 3, o el garaje"
          maxLength={120}
          error={errores.lugar}
        />
        <AreaTexto
          etiqueta="Algo más que convenga saber (opcional)"
          name="detalle"
          rows={3}
          maxLength={1000}
          error={errores.detalle}
        />
        <Boton
          type="button"
          variante="peligro"
          className="self-start"
          onClick={() => {
            if (!tipo) return setFaltaTipo(true);
            setPaso("confirmar");
          }}
        >
          Seguir
        </Boton>
      </div>

      {paso === "confirmar" && tipo && (
        <section
          aria-labelledby="confirmar"
          className="flex flex-col gap-4 rounded-[var(--radius-tecla)] border border-junta bg-losa p-4 md:p-6"
        >
          <h2
            id="confirmar"
            ref={titulo}
            tabIndex={-1}
            className="text-titulo font-bold outline-none"
          >
            ¿Estás seguro de que es una emergencia?
          </h2>
          <p>
            Vas a avisar <strong>{NOMBRE_TIPO[tipo].toLowerCase()}</strong>. Le
            llega ahora a Portería, a la Administración y a la Comisión, con tu
            nombre y tu unidad. Usalo solo si es una emergencia real.
          </p>
          <input type="hidden" name="confirmado" value="si" />
          <BotonMantener
            deshabilitado={pendiente}
            alConfirmar={() => form.current?.requestSubmit()}
          >
            {pendiente ? "Avisando…" : "Mantené apretado para avisar"}
          </BotonMantener>
          <Boton
            type="button"
            variante="texto"
            className="self-start"
            onClick={() => setPaso("datos")}
            disabled={pendiente}
          >
            Volver y corregir
          </Boton>
        </section>
      )}
    </form>
  );
}
