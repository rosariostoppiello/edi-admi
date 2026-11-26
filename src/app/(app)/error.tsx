"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Boton } from "@/componentes/ui/boton";

/**
 * Error inesperado dentro de una pantalla: qué pasó y cómo seguir. No muestra el
 * detalle técnico (puede tener datos); el código sirve para buscarlo en los logs.
 */
export default function ErrorPantalla({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const codigo = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="flex max-w-prose flex-col gap-4">
      <h1 className="text-grande font-bold">No pudimos mostrar esta pantalla</h1>
      <p className="text-pizarra-suave">
        Puede ser un problema de conexión o algo que falló de nuestro lado. Lo que ya habías guardado está a salvo. Probá de nuevo; si sigue
        pasando, avisale a la Administración{codigo ? ` con este código: ${codigo}` : ""}.
      </p>
      <div className="flex flex-wrap gap-3">
        <Boton type="button" onClick={() => retry()}>
          Probar de nuevo
        </Boton>
        <Link href="/inicio" className="inline-flex min-h-12 items-center px-2 font-bold underline underline-offset-4 hover:text-bronce-texto">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
