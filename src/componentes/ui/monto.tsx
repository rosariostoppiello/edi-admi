import { formatearNumero, formatearPesos, type Centesimos } from "@/dominio/dinero";

/**
 * Monto en pesos con cifras tabulares. `vacioSiCero` deja la celda en blanco
 * (como en la tabla del PDF) para que se lean solo los cargos que existen.
 */
export function Monto({
  valor,
  conSimbolo = false,
  vacioSiCero = false,
  className = "",
}: {
  valor: number;
  conSimbolo?: boolean;
  vacioSiCero?: boolean;
  className?: string;
}) {
  if (vacioSiCero && valor === 0) return <span className={className} />;
  const texto = conSimbolo ? formatearPesos(valor as Centesimos) : formatearNumero(valor as Centesimos);
  return <span className={`tabular-nums whitespace-nowrap ${className}`}>{texto}</span>;
}

/** Texto plano para el monto (atributos, mensajes). */
// Con espacio duro: "$U" y el número no se separan en dos renglones.
export const pesos = (valor: number) => formatearPesos(valor as Centesimos).replace(/\s/g, "\u00a0");
