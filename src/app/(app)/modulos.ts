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
      { ruta: "/reservas/barbacoas", nombre: "Barbacoas" },
      { ruta: "/reservas/solarium", nombre: "Solarium" },
      { ruta: "/reservas/laundry", nombre: "Laundry" },
      // Solo en los edificios que tienen piscina (la página de Reservas la filtra).
      { ruta: "/reservas/piscina", nombre: "Piscina" },
    ],
  },
  {
    ruta: "/solicitudes",
    nombre: "Solicitudes varias",
    descripcion: "Avisá un desperfecto o hacé una consulta",
    Icono: IconoSolicitudes,
    subteclas: [
      { ruta: "/solicitudes/desperfectos", nombre: "Aviso de desperfectos" },
      { ruta: "/solicitudes/consultas", nombre: "Consultas de gastos comunes" },
      { ruta: "/solicitudes/inquietudes", nombre: "Inquietudes varias" },
    ],
  },
  {
    ruta: "/comunicados",
    nombre: "Comunicados de la Administración",
    descripcion: "Avisos, reglamentos y actas de asambleas",
    Icono: IconoComunicados,
    subteclas: [
      { ruta: "/comunicados/avisos", nombre: "Avisos importantes" },
      { ruta: "/comunicados/reglamentos", nombre: "Reglamentos" },
      { ruta: "/comunicados/actas", nombre: "Actas de asambleas" },
    ],
  },
  {
    ruta: "/telefonos",
    nombre: "Teléfonos y datos de interés",
    descripcion: "Administración, empresas, servicios y seguro",
    Icono: IconoTelefonos,
    subteclas: [
      { ruta: "/telefonos/administracion", nombre: "Administración" },
      { ruta: "/telefonos/comision", nombre: "Comisión administradora" },
      { ruta: "/telefonos/porteria", nombre: "Portería" },
      { ruta: "/telefonos/empresas", nombre: "Empresas" },
      { ruta: "/telefonos/servicios", nombre: "Servicios públicos" },
      { ruta: "/telefonos/seguro", nombre: "Seguro de incendio" },
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

/** Módulos que se pueden apagar por edificio (Datos siempre está: ahí se manejan las cuentas). */
export const MODULOS_OPCIONALES = MODULOS.filter((m) => m.ruta !== "/datos");

/** ¿Está prendido el módulo en el edificio? Sin lista guardada, están todos (decisión 87). */
export function moduloPrendido(modulosDelEdificio: string[], ruta: string): boolean {
  return ruta === "/datos" || modulosDelEdificio.length === 0 || modulosDelEdificio.includes(ruta);
}

/** Los módulos del inicio, según el edificio. */
export function modulosDelEdificio(modulosDelEdificio: string[]): Modulo[] {
  return MODULOS.filter((m) => moduloPrendido(modulosDelEdificio, m.ruta));
}

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
    : { href: "/inicio", texto: "Inicio" };
}
