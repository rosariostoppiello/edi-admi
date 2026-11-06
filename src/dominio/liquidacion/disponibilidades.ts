/**
 * Disponibilidades al cierre (sección 2 del PDF modelo).
 *
 * Simplificación elegida (docs/PLAN.md, decisión 10): Administración carga a
 * mano los saldos iniciales y la parte de los ingresos que va al fondo de
 * reserva; el sistema calcula el resto (ingresos, depósitos identificados,
 * egresos y saldo final). Las otras cuentas (caja chica, cuenta en dólares)
 * son listas de movimientos con concepto y monto.
 */
import { z } from "zod";
import { centesimos, sumar, type Centesimos } from "../dinero";

const monto = z.number().int();

export const disponibilidadesSchema = z.object({
  nombreCuenta: z.string().trim().max(80).default("Cuenta corriente"),
  saldoInicial: z.object({ gc: monto, fr: monto, dni: monto }).default({ gc: 0, fr: 0, dni: 0 }),
  /** Parte de los ingresos del mes que se asigna al fondo de reserva. */
  ingresosFondoReserva: monto.default(0),
  otras: z
    .array(
      z.object({
        nombre: z.string().trim().min(1).max(80),
        moneda: z.enum(["UYU", "USD"]),
        saldoInicial: monto,
        movimientos: z.array(z.object({ concepto: z.string().trim().min(1).max(120), monto })).max(30),
      }),
    )
    .max(5)
    .default([]),
});

export type Disponibilidades = z.infer<typeof disponibilidadesSchema>;

export const DISPONIBILIDADES_VACIAS: Disponibilidades = disponibilidadesSchema.parse({});

export interface Fondos {
  gc: Centesimos;
  fr: Centesimos;
  dni: Centesimos;
  total: Centesimos;
}

function fondos(gc: number, fr: number, dni: number): Fondos {
  return { gc: centesimos(gc), fr: centesimos(fr), dni: centesimos(dni), total: sumar(centesimos(gc), centesimos(fr), centesimos(dni)) };
}

export interface CuentaCalculada {
  saldoInicial: Fondos;
  ingresos: Fondos;
  depositosIdentificados: { codigo: string; monto: Centesimos }[];
  egresosGastosComunes: Centesimos;
  egresosCargoPropietarios: Centesimos;
  saldoFinal: Fondos;
}

export function calcularCuenta(
  d: Disponibilidades,
  datos: {
    /** Pagos registrados de las unidades, sin contar los depósitos identificados. */
    totalPagos: number;
    /** Depósitos no identificados que entraron este mes. */
    totalDepositosNuevos: number;
    /** Depósitos de meses anteriores (o de este) que se asignaron a una unidad este mes. */
    identificados: { codigo: string; monto: number }[];
    totalEgresos: number;
    totalCargoPropietarios: number;
  },
): CuentaCalculada {
  const ini = fondos(d.saldoInicial.gc, d.saldoInicial.fr, d.saldoInicial.dni);
  const ingresos = fondos(datos.totalPagos - d.ingresosFondoReserva, d.ingresosFondoReserva, datos.totalDepositosNuevos);
  const identificado = datos.identificados.reduce((s, x) => s + x.monto, 0);
  const egresosGC = centesimos(datos.totalEgresos - datos.totalCargoPropietarios);
  const egresosProp = centesimos(datos.totalCargoPropietarios);
  const saldoFinal = fondos(
    ini.gc + ingresos.gc + identificado - egresosGC - egresosProp,
    ini.fr + ingresos.fr,
    ini.dni + ingresos.dni - identificado,
  );
  return {
    saldoInicial: ini,
    ingresos,
    depositosIdentificados: datos.identificados.map((x) => ({ codigo: x.codigo, monto: centesimos(x.monto) })),
    egresosGastosComunes: egresosGC,
    egresosCargoPropietarios: egresosProp,
    saldoFinal,
  };
}

export function saldoFinalOtra(c: Disponibilidades["otras"][number]): Centesimos {
  return sumar(centesimos(c.saldoInicial), ...c.movimientos.map((m) => centesimos(m.monto)));
}

/** Disponibilidades del mes siguiente: arrancan con los saldos finales de este. */
export function arrastrarDisponibilidades(d: Disponibilidades, cuenta: CuentaCalculada): Disponibilidades {
  return {
    nombreCuenta: d.nombreCuenta,
    saldoInicial: { gc: cuenta.saldoFinal.gc, fr: cuenta.saldoFinal.fr, dni: cuenta.saldoFinal.dni },
    ingresosFondoReserva: 0,
    otras: d.otras.map((o) => ({ nombre: o.nombre, moneda: o.moneda, saldoInicial: saldoFinalOtra(o), movimientos: [] })),
  };
}
