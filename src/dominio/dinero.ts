/**
 * Dinero en pesos uruguayos representado como ENTEROS en centésimos.
 * Nunca se usan floats para montos: toda operación es sobre enteros.
 */

export type Centesimos = number & { readonly __brand: "Centesimos" };

function asegurarEntero(n: number, origen: string): void {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${origen}: se esperaba un entero de centésimos, llegó ${n}`);
  }
}

export function centesimos(n: number): Centesimos {
  asegurarEntero(n, "centesimos");
  return n as Centesimos;
}

export const CERO = centesimos(0);

export function sumar(...montos: Centesimos[]): Centesimos {
  let total = 0;
  for (const m of montos) total += m;
  asegurarEntero(total, "sumar");
  return total as Centesimos;
}

export function restar(a: Centesimos, b: Centesimos): Centesimos {
  return centesimos(a - b);
}

/**
 * Parte un texto de monto en formato es-UY ("1.234,56", "-50", "$U 12.000")
 * o con punto decimal simple ("1234.56") y devuelve centésimos exactos.
 * No usa parseFloat: separa enteros y decimales como texto.
 */
export function parsearMonto(texto: string): Centesimos {
  let s = texto.trim().replace(/^\$U\s*|^\$\s*/i, "").replace(/\s/g, "");
  if (s === "") throw new Error("Monto vacío");
  let negativo = false;
  if (s.startsWith("-")) {
    negativo = true;
    s = s.slice(1);
  }
  let entera: string;
  let decimal = "";
  if (s.includes(",")) {
    // es-UY: punto de miles, coma decimal
    const [e, d, ...resto] = s.split(",");
    if (resto.length > 0) throw new Error(`Monto inválido: "${texto}"`);
    entera = e.replace(/\./g, "");
    decimal = d;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // solo separadores de miles: "12.000"
    entera = s.replace(/\./g, "");
  } else {
    const [e, d, ...resto] = s.split(".");
    if (resto.length > 0) throw new Error(`Monto inválido: "${texto}"`);
    entera = e;
    decimal = d ?? "";
  }
  if (!/^\d+$/.test(entera) || !/^\d{0,2}$/.test(decimal)) {
    throw new Error(`Monto inválido: "${texto}"`);
  }
  const valor = Number(entera) * 100 + Number(decimal.padEnd(2, "0") || "0");
  return centesimos(negativo ? -valor : valor);
}

/**
 * Porcentaje de un monto, redondeado al PESO entero (así lo hace la liquidación:
 * intereses y fondo de reserva en pesos sin centésimos).
 * `porcentajeBasico` en puntos básicos para evitar floats: 1% = 100, 5% = 500.
 * Redondeo "half away from zero".
 */
export function porcentajeAlPeso(monto: Centesimos, porcentajeBasico: number): Centesimos {
  asegurarEntero(porcentajeBasico, "porcentajeAlPeso");
  // monto(centésimos) * pb / 10000 = centésimos del resultado; luego al peso: /100
  const numerador = monto * porcentajeBasico; // centésimos * pb
  const divisor = 10000 * 100; // a pesos
  const signo = numerador < 0 ? -1 : 1;
  const abs = Math.abs(numerador);
  const pesos = Math.floor((abs + divisor / 2) / divisor);
  return centesimos(signo * pesos * 100);
}

const formatoPesos = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1.234,56" (sin símbolo). */
export function formatearNumero(monto: Centesimos): string {
  // Se formatea la parte entera y decimal por separado para no pasar por float.
  const negativo = monto < 0;
  const abs = Math.abs(monto);
  const entera = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  const enteraTxt = formatoPesos.format(entera).split(",")[0];
  return `${negativo ? "-" : ""}${enteraTxt},${dec}`;
}

/** "$U 1.234,56" */
export function formatearPesos(monto: Centesimos): string {
  return `$U ${formatearNumero(monto)}`;
}
