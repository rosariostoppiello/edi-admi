import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components queda desactivado a propósito: casi todas las pantallas
  // dependen de la sesión, y el renderizado dinámico clásico es más simple.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  // exceljs usa módulos de Node: se carga tal cual en el servidor, sin empaquetar.
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Planillas de ingresos de hasta 3 MB (+ margen del multipart).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
