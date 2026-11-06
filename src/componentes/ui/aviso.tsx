import type { ReactNode } from "react";
import { IconoAlerta, IconoOk } from "./iconos";

type Tono = "error" | "ok" | "info";

const tonos: Record<Tono, string> = {
  error: "border-alerta bg-alerta-fondo text-alerta",
  ok: "border-ok bg-ok-fondo text-ok",
  info: "border-junta-fuerte bg-losa text-pizarra",
};

/** Mensaje de estado. `role` alert para errores, status para el resto. */
export function Aviso({ tono = "info", children }: { tono?: Tono; children: ReactNode }) {
  const Icono = tono === "ok" ? IconoOk : IconoAlerta;
  return (
    <div
      role={tono === "error" ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-[var(--radius-campo)] border-l-4 px-4 py-3 ${tonos[tono]}`}
    >
      {tono !== "info" && <Icono className="mt-1 size-5 shrink-0" />}
      <div className="font-bold">{children}</div>
    </div>
  );
}
