"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { IconoEmergencia } from "@/componentes/ui/iconos";

export interface Alerta {
  id: string;
  texto: string;
  /** true: la ve Portería, Administración o la Comisión (con enlace al detalle). */
  equipo: boolean;
}

const VISTAS = "emergencias-vistas";
const REFRESCO_MS = 15_000;

function leerVistas(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(VISTAS) ?? "[]");
  } catch {
    return [];
  }
}

/** Tres pitidos cortos con Web Audio (sin archivos). Si el navegador no deja, no pasa nada. */
function sonar() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = 880;
      vol.gain.value = 0.2;
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.2);
    }
  } catch {
    // Sin audio.
  }
}

/**
 * Franja roja con las emergencias activas. Para Portería, Administración y Comisión
 * (`refrescar`) la pantalla se actualiza sola cada 15 segundos y suena cuando
 * aparece un aviso nuevo, para que lo noten aunque estén en otra pantalla.
 */
export function AlertaEmergencia({
  alertas,
  refrescar,
}: {
  alertas: Alerta[];
  refrescar: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!refrescar) return;
    const t = setInterval(() => router.refresh(), REFRESCO_MS);
    return () => clearInterval(t);
  }, [refrescar, router]);

  const ids = alertas.map((a) => a.id).join(",");
  useEffect(() => {
    const vistas = leerVistas();
    const nuevas = alertas.filter((a) => !vistas.includes(a.id));
    if (nuevas.length && refrescar) sonar();
    try {
      sessionStorage.setItem(
        VISTAS,
        JSON.stringify([...vistas, ...nuevas.map((a) => a.id)].slice(-50)),
      );
    } catch {
      // Sin almacenamiento: puede sonar de nuevo, no es grave.
    }
    // El título de la pestaña avisa aunque la ventana esté atrás.
    const base = document.title.replace(/^¡EMERGENCIA! /, "");
    document.title = alertas.length ? `¡EMERGENCIA! ${base}` : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, refrescar]);

  if (!alertas.length) return null;
  return (
    <div role="alert" className="bg-alerta text-white">
      <ul className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
        {alertas.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <IconoEmergencia className="size-6 shrink-0" />
            <span className="font-bold">
              {a.equipo ? `Emergencia activa: ${a.texto}` : a.texto}
            </span>
            {a.equipo && (
              <Link
                href={`/emergencia/avisos/${a.id}`}
                className="inline-flex min-h-11 items-center font-bold underline underline-offset-4"
              >
                Ver el aviso
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
