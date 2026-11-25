import type { SVGProps } from "react";

/** Íconos de trazo propios (24×24, trazo 1,75). Siempre acompañados de texto. */
function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

type P = SVGProps<SVGSVGElement>;

/** Recibo con borde dentado: la liquidación mensual. */
export const IconoLiquidacion = (p: P) => (
  <Base {...p}>
    <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Base>
);

/** Parrilla: reserva de barbacoas y espacios. */
export const IconoReservas = (p: P) => (
  <Base {...p}>
    <path d="M4 10h16a8 8 0 0 1-16 0z" />
    <path d="M8 6c0-1 1-1.5 1-2.5M12 6c0-1 1-1.5 1-2.5M16 6c0-1 1-1.5 1-2.5" />
    <path d="M9 17.5 7 21M15 17.5l2 3.5" />
  </Base>
);

/** Persona con ficha: datos de propietarios e inquilinos. */
export const IconoDatos = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2.25" />
    <path d="M5.5 16.5c.6-1.8 2-2.75 3.5-2.75s2.9.95 3.5 2.75M15 10h3M15 13.5h3" />
  </Base>
);

/** Auricular: teléfonos y servicios. */
export const IconoTelefonos = (p: P) => (
  <Base {...p}>
    <path d="M5 4h3.5l1.5 4-2.25 1.5a11 11 0 0 0 6.75 6.75L16 14l4 1.5V19a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />
  </Base>
);

/** Llave inglesa con globo: solicitudes y avisos de desperfectos. */
export const IconoSolicitudes = (p: P) => (
  <Base {...p}>
    <path d="M4 5h16v11H9l-4 3.5V16H4z" />
    <path d="M10 9.5h6M10 12.5h4" />
  </Base>
);

/** Cartelera con chinche: comunicados de la administración. */
export const IconoComunicados = (p: P) => (
  <Base {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <circle cx="12" cy="5" r="1.5" />
    <path d="M7 10h10M7 13h10M7 16h6" />
  </Base>
);

export const IconoAlerta = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </Base>
);

export const IconoOk = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.75 2.75L16 10" />
  </Base>
);

export const IconoVolver = (p: P) => (
  <Base {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Base>
);

/** Ojo: mostrar la contraseña. */
export const IconoOjo = (p: P) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
);

/** Ojo tachado: ocultar la contraseña. */
export const IconoOjoTachado = (p: P) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </Base>
);

/** Luz de emergencia: el botón de emergencia. */
export const IconoEmergencia = (p: P) => (
  <Base {...p}>
    <path d="M7 18v-5a5 5 0 0 1 10 0v5" />
    <path d="M5 21h14v-3H5z" />
    <path d="M12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4" />
  </Base>
);

/** Teléfono: llamar. */
export const IconoLlamar = (p: P) => (
  <Base {...p}>
    <path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Base>
);
