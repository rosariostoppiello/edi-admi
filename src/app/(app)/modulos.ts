import type { ComponentType, SVGProps } from "react";
import {
  IconoComunicados,
  IconoDatos,
  IconoLiquidacion,
  IconoReservas,
  IconoSolicitudes,
  IconoTelefonos,
} from "@/componentes/ui/iconos";

export interface Modulo {
  ruta: string;
  nombre: string;
  descripcion: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
  /** Fase del plan en la que se implementa (mientras tanto se muestra un aviso). */
  fase: number;
}

/** Los 6 botones del home, en el orden de la especificación. */
export const MODULOS: Modulo[] = [
  {
    ruta: "/liquidaciones",
    nombre: "Liquidación de gastos comunes",
    descripcion: "Tu cuenta y la liquidación de cada mes",
    Icono: IconoLiquidacion,
    fase: 3,
  },
  {
    ruta: "/reservas",
    nombre: "Reservas",
    descripcion: "Barbacoas y espacios comunes",
    Icono: IconoReservas,
    fase: 4,
  },
  {
    ruta: "/datos",
    nombre: "Propietarios e inquilinos",
    descripcion: "Tus datos de contacto y tu inquilino",
    Icono: IconoDatos,
    fase: 2,
  },
  {
    ruta: "/telefonos",
    nombre: "Teléfonos y servicios",
    descripcion: "Empresas de mantenimiento, UTE, OSE y seguro",
    Icono: IconoTelefonos,
    fase: 5,
  },
  {
    ruta: "/solicitudes",
    nombre: "Solicitudes",
    descripcion: "Avisá un desperfecto o hacé una consulta",
    Icono: IconoSolicitudes,
    fase: 6,
  },
  {
    ruta: "/comunicados",
    nombre: "Comunicados",
    descripcion: "Avisos, actas de asamblea y reglamentos",
    Icono: IconoComunicados,
    fase: 7,
  },
];
