/**
 * Validación de planillas de ingresos y de saldos iniciales.
 * Recibe las celdas ya leídas (de .xlsx o .csv) y devuelve cada fila con sus
 * errores y avisos, para mostrar la vista previa antes de confirmar.
 *
 * Formato (la primera fila con encabezados reconocibles; el orden no importa):
 * - Ingresos: Fecha | Unidad | Monto | Referencia (opcional)
 * - Saldos iniciales: Unidad | Saldo
 */
import { parsearMonto, type Centesimos } from "../dinero";
import { formatearCodigo, parsearCodigo, type Sufijo } from "../codigos";
import { enPeriodo, parsearFecha } from "./periodo";

export type Celda = string | number | boolean | Date | null | undefined;

export interface UnidadConocida {
  unidadId: string;
  torre: number;
  numero: string;
  arrendada: boolean;
}

export interface FilaImportada {
  /** Número de fila en la planilla (1 = primera fila, como la ve la persona). */
  fila: number;
  codigo: string;
  unidadId: string | null;
  sufijo: Sufijo | null;
  fecha: string | null;
  monto: number | null;
  referencia: string | null;
  errores: string[];
  avisos: string[];
}

export interface ResultadoImportacion {
  filas: FilaImportada[];
  /** Error general (ej. no se encontraron los encabezados). */
  error: string | null;
  totalValido: number;
  cantidadErrores: number;
}

const ENCABEZADOS = {
  fecha: ["fecha", "fecha de pago", "fecha pago", "fecha de cobro"],
  unidad: ["unidad", "codigo", "código", "apto", "nro. apto.", "nro apto", "apartamento"],
  monto: ["monto", "importe", "pago", "valor"],
  saldo: ["saldo", "saldo anterior", "saldo inicial"],
  referencia: ["referencia", "detalle", "concepto", "documento"],
};

function normalizar(c: Celda): string {
  return String(c ?? "")
    .trim()
    .toLowerCase();
}

function textoDe(c: Celda): string {
  if (c instanceof Date) return c.toISOString().slice(0, 10);
  return String(c ?? "").trim();
}

/**
 * Monto desde una celda. Excel guarda los números como doble precisión: se
 * convierten a texto con 2 decimales y se parsean como texto (sin floats en
 * la cuenta). Si la celda tiene más de 2 decimales, es un error.
 */
export function montoDeCelda(c: Celda): Centesimos {
  if (typeof c === "number") {
    if (!Number.isFinite(c)) throw new Error("no es un número");
    const texto = c.toFixed(2);
    if (Math.abs(Number(texto) - c) > 1e-9) throw new Error("tiene más de 2 decimales");
    return parsearMonto(texto);
  }
  const t = textoDe(c);
  if (!t) throw new Error("está vacío");
  return parsearMonto(t);
}

/** Fecha desde una celda: Date de Excel, número de serie de Excel o texto dd/mm/aaaa. */
export function fechaDeCelda(c: Celda): string | null {
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null;
    return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, "0")}-${String(c.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof c === "number" && Number.isInteger(c) && c > 20000 && c < 80000) {
    // Número de serie de Excel: días desde el 30/12/1899.
    const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000);
    return fechaDeCelda(d);
  }
  return parsearFecha(textoDe(c));
}

function buscarEncabezados(filas: Celda[][], requeridos: (keyof typeof ENCABEZADOS)[], opcionales: (keyof typeof ENCABEZADOS)[]) {
  for (let i = 0; i < Math.min(filas.length, 10); i++) {
    const cols: Partial<Record<keyof typeof ENCABEZADOS, number>> = {};
    filas[i].forEach((celda, j) => {
      const t = normalizar(celda);
      for (const k of [...requeridos, ...opcionales]) {
        if (cols[k] === undefined && ENCABEZADOS[k].includes(t)) cols[k] = j;
      }
    });
    if (requeridos.every((k) => cols[k] !== undefined)) return { fila: i, cols };
  }
  return null;
}

export function resolverUnidad(texto: string, unidades: Map<string, UnidadConocida>) {
  const codigo = parsearCodigo(texto);
  if (!codigo) return { error: `"${texto}" no es un código de unidad válido (ej. 2-201-A).` } as const;
  const u = unidades.get(`${codigo.torre}-${codigo.numero}`);
  const normal = formatearCodigo(codigo);
  if (!u) return { error: `La unidad ${codigo.torre}-${codigo.numero} no existe.`, codigo: normal } as const;
  if (u.arrendada && codigo.sufijo === "A") {
    return { error: `${normal}: la unidad está alquilada, usá ${codigo.torre}-${codigo.numero}-P o -I.`, codigo: normal } as const;
  }
  if (!u.arrendada && codigo.sufijo !== "A") {
    return { error: `${normal}: la unidad no está alquilada, usá ${codigo.torre}-${codigo.numero}-A.`, codigo: normal } as const;
  }
  return { unidad: u, sufijo: codigo.sufijo, codigo: normal } as const;
}

/** Mensaje para un monto que no se pudo leer. */
function problemaMonto(e: unknown, celda: Celda): string {
  const m = (e as Error).message;
  return m.startsWith("Monto") ? `no es válido ("${textoDe(celda)}")` : m;
}

function vacia(fila: Celda[]) {
  return fila.every((c) => textoDe(c) === "");
}

export function indexarUnidades(unidades: UnidadConocida[]) {
  return new Map(unidades.map((u) => [`${u.torre}-${u.numero.toUpperCase()}`, u]));
}

function resumir(filas: FilaImportada[], error: string | null = null): ResultadoImportacion {
  const cantidadErrores = filas.filter((f) => f.errores.length > 0).length;
  const totalValido = filas.filter((f) => f.errores.length === 0).reduce((s, f) => s + (f.monto ?? 0), 0);
  return { filas, error, totalValido, cantidadErrores };
}

export const MAX_FILAS = 2000;

export function validarIngresos(
  celdas: Celda[][],
  opciones: {
    periodo: string;
    unidades: UnidadConocida[];
    /** Ingresos ya cargados en la liquidación, para avisar posibles repetidos. */
    existentes: { unidadId: string; sufijo: Sufijo; fecha: string; monto: number }[];
  },
): ResultadoImportacion {
  const enc = buscarEncabezados(celdas, ["fecha", "unidad", "monto"], ["referencia"]);
  if (!enc) {
    return resumir([], "No encontramos los encabezados. La primera fila tiene que decir Fecha, Unidad y Monto (y opcionalmente Referencia).");
  }
  const datos = celdas.slice(enc.fila + 1);
  if (datos.length > MAX_FILAS) return resumir([], `La planilla tiene más de ${MAX_FILAS} filas. Dividila en partes.`);

  const unidades = indexarUnidades(opciones.unidades);
  const clave = (unidadId: string, sufijo: string, fecha: string, monto: number) => `${unidadId}|${sufijo}|${fecha}|${monto}`;
  const yaCargados = new Set(opciones.existentes.map((x) => clave(x.unidadId, x.sufijo, x.fecha, x.monto)));
  const enArchivo = new Map<string, number>();
  const filas: FilaImportada[] = [];

  datos.forEach((celdasFila, i) => {
    if (vacia(celdasFila)) return;
    const numero = enc.fila + 2 + i;
    const f: FilaImportada = {
      fila: numero,
      codigo: textoDe(celdasFila[enc.cols.unidad!]),
      unidadId: null,
      sufijo: null,
      fecha: null,
      monto: null,
      referencia: enc.cols.referencia !== undefined ? textoDe(celdasFila[enc.cols.referencia]).slice(0, 120) || null : null,
      errores: [],
      avisos: [],
    };

    const u = resolverUnidad(f.codigo, unidades);
    if ("error" in u) {
      f.errores.push(u.error!);
      if (u.codigo) f.codigo = u.codigo;
    } else {
      f.unidadId = u.unidad.unidadId;
      f.sufijo = u.sufijo;
      f.codigo = u.codigo;
    }

    f.fecha = fechaDeCelda(celdasFila[enc.cols.fecha!]);
    if (!f.fecha) f.errores.push(`La fecha "${textoDe(celdasFila[enc.cols.fecha!])}" no es válida (usá dd/mm/aaaa).`);
    else if (!enPeriodo(f.fecha, opciones.periodo)) f.avisos.push("La fecha es de otro mes.");

    try {
      const m = montoDeCelda(celdasFila[enc.cols.monto!]);
      if (m <= 0) f.errores.push("El monto tiene que ser mayor que cero.");
      else f.monto = m;
    } catch (e) {
      f.errores.push(`El monto ${problemaMonto(e, celdasFila[enc.cols.monto!])}.`);
    }

    if (f.errores.length === 0) {
      const k = clave(f.unidadId!, f.sufijo!, f.fecha!, f.monto!);
      if (yaCargados.has(k)) f.avisos.push("Ya hay un pago igual cargado (misma unidad, fecha y monto).");
      const previa = enArchivo.get(k);
      if (previa) f.avisos.push(`Igual a la fila ${previa}.`);
      else enArchivo.set(k, numero);
    }
    filas.push(f);
  });

  if (filas.length === 0) return resumir([], "La planilla no tiene filas con datos debajo de los encabezados.");
  return resumir(filas);
}

export function validarSaldosIniciales(celdas: Celda[][], opciones: { unidades: UnidadConocida[] }): ResultadoImportacion {
  const enc = buscarEncabezados(celdas, ["unidad", "saldo"], []);
  if (!enc) return resumir([], "No encontramos los encabezados. La primera fila tiene que decir Unidad y Saldo.");
  const datos = celdas.slice(enc.fila + 1);
  if (datos.length > MAX_FILAS) return resumir([], `La planilla tiene más de ${MAX_FILAS} filas.`);

  const unidades = indexarUnidades(opciones.unidades);
  const vistos = new Map<string, number>();
  const filas: FilaImportada[] = [];
  datos.forEach((celdasFila, i) => {
    if (vacia(celdasFila)) return;
    const numero = enc.fila + 2 + i;
    const f: FilaImportada = {
      fila: numero,
      codigo: textoDe(celdasFila[enc.cols.unidad!]),
      unidadId: null,
      sufijo: null,
      fecha: null,
      monto: null,
      referencia: null,
      errores: [],
      avisos: [],
    };
    const u = resolverUnidad(f.codigo, unidades);
    if ("error" in u) {
      f.errores.push(u.error!);
      if (u.codigo) f.codigo = u.codigo;
    } else {
      f.unidadId = u.unidad.unidadId;
      f.sufijo = u.sufijo;
      f.codigo = u.codigo;
      const previa = vistos.get(f.codigo);
      if (previa) f.errores.push(`La unidad ya aparece en la fila ${previa}.`);
      else vistos.set(f.codigo, numero);
    }
    try {
      f.monto = montoDeCelda(celdasFila[enc.cols.saldo!]);
    } catch (e) {
      f.errores.push(`El saldo ${problemaMonto(e, celdasFila[enc.cols.saldo!])}.`);
    }
    filas.push(f);
  });
  if (filas.length === 0) return resumir([], "La planilla no tiene filas con datos debajo de los encabezados.");
  return resumir(filas);
}

/** CSV simple (separador ; o ,) a celdas de texto. Los montos se parsean como texto, nunca como float. */
export function leerCsv(texto: string): Celda[][] {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/);
  const primera = lineas.find((l) => l.trim()) ?? "";
  const sep = (primera.match(/;/g)?.length ?? 0) >= (primera.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lineas.map((linea) => {
    const celdas: string[] = [];
    let actual = "";
    let comillas = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (comillas) {
        if (ch === '"' && linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else if (ch === '"') comillas = false;
        else actual += ch;
      } else if (ch === '"') comillas = true;
      else if (ch === sep) {
        celdas.push(actual);
        actual = "";
      } else actual += ch;
    }
    celdas.push(actual);
    return celdas;
  });
}

