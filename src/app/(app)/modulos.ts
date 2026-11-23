import type { ComponentType, SVGProps } from "react";
import {
  IconoComunicados,
  IconoDatos,
  IconoLiquidacion,
  IconoReservas,
  IconoSolicitudes,
  IconoTelefonos,
} from "@/componentes/ui/iconos";
import { puede, type Actor } from "@/dominio/permisos";

/** Un sub-botón. `visible` filtra por permiso (la UI oculta; el servidor igual valida). */
export interface Subtecla {
  ruta: string;
  nombre: string;
  visible?: (actor: Actor) => boolean;
  /** Fase en la que se implementa (mientras tanto, aviso "en construcción"). */
  fase?: number;
}

export interface Modulo {
  ruta: string;
  nombre: string;
  descripcion: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
  subteclas: Subtecla[];
}

/**
 * Los 6 botones del home y sus sub-botones, en el orden de "Proyecto en gráfico"
 * (docs/PROYECTO-EN-GRAFICO.md, C.0).
 */
export const MODULOS: Modulo[] = [
  {
    ruta: "/liquidaciones",
    nombre: "Liquidación de gastos comunes",
    descripcion: "Tu liquidación del mes y las anteriores",
    Icono: IconoLiquidacion,
    subteclas: [
      { ruta: "/liquidaciones/mensual", nombre: "Liquidación mensual" },
      {
        ruta: "/liquidaciones/confeccion",
        nombre: "Confección de la liquidación mensual",
        visible: (a) => puede(a, "liquidacion.confeccionar"),
      },
    ],
  },
  {
    ruta: "/reservas",
    nombre: "Reserva de espacios comunes",
    descripcion: "Barbacoas, solarium y laundry",
    Icono: IconoReservas,
    subteclas: [
      { ruta: "/reservas/barbacoas", nombre: "Barbacoas", fase: 5 },
      { ruta: "/reservas/solarium", nombre: "Solarium", fase: 5 },
      { ruta: "/reservas/laundry", nombre: "Laundry", fase: 5 },
    ],
  },
  {
    ruta: "/solicitudes",
    nombre: "Solicitudes varias",
    descripcion: "Avisá un desperfecto o hacé una consulta",
    Icono: IconoSolicitudes,
    subteclas: [
      { ruta: "/solicitudes/desperfectos", nombre: "Aviso de desperfectos", fase: 6 },
      { ruta: "/solicitudes/consultas", nombre: "Consultas de gastos comunes", fase: 6 },
      { ruta: "/solicitudes/inquietudes", nombre: "Inquietudes varias", fase: 6 },
    ],
  },
  {
    ruta: "/comunicados",
    nombre: "Comunicados de la Administración",
    descripcion: "Avisos, reglamentos y actas de asambleas",
    Icono: IconoComunicados,
    subteclas: [
      { ruta: "/comunicados/avisos", nombre: "Avisos importantes", fase: 7 },
      { ruta: "/comunicados/reglamentos", nombre: "Reglamentos", fase: 7 },
      { ruta: "/comunicados/actas", nombre: "Actas de asambleas", fase: 7 },
    ],
  },
  {
    ruta: "/telefonos",
    nombre: "Teléfonos y datos de interés",
    descripcion: "Administración, empresas, servicios y seguro",
    Icono: IconoTelefonos,
    subteclas: [
      { ruta: "/telefonos/administracion", nombre: "Administración", fase: 8 },
      { ruta: "/telefonos/comision", nombre: "Comisión administradora", fase: 8 },
      { ruta: "/telefonos/porteria", nombre: "Portería", fase: 8 },
      { ruta: "/telefonos/empresas", nombre: "Empresas", fase: 8 },
      { ruta: "/telefonos/servicios", nombre: "Servicios públicos", fase: 8 },
      { ruta: "/telefonos/seguro", nombre: "Seguro de incendio", fase: 8 },
    ],
  },
  {
    ruta: "/datos",
    nombre: "Datos de propietarios e inquilinos",
    descripcion: "Tus datos de contacto y tu inquilino",
    Icono: IconoDatos,
    subteclas: [{ ruta: "/datos/editar", nombre: "Editar" }],
  },
];

/** Sub-botones de "Liquidación mensual" (C.1). */
export const LIQUIDACION_MENSUAL: Subtecla[] = [
  { ruta: "/liquidaciones/ultima", nombre: "Última liquidación" },
  { ruta: "/liquidaciones/anteriores", nombre: "Liquidaciones anteriores" },
];

export function buscarModulo(ruta: string) {
  return MODULOS.find((m) => m.ruta === ruta);
}

export function subteclasVisibles(subteclas: Subtecla[], actor: Actor) {
  return subteclas.filter((s) => !s.visible || s.visible(actor));
}

/**
 * A dónde vuelve "Liquidación mensual": si el usuario ve un solo sub-botón en
 * Liquidación (se saltó ese nivel), vuelve al inicio para no rebotar.
 */
export function volverDeLiquidacionMensual(actor: Actor) {
  const liq = buscarModulo("/liquidaciones")!;
  return subteclasVisibles(liq.subteclas, actor).length > 1
    ? { href: "/liquidaciones", texto: "Liquidación de gastos comunes" }
    : { href: "/", texto: "Inicio" };
}
