import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";
import { LEMA, MARCA } from "@/lib/marca";

const texto = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--fuente-texto",
  display: "swap",
  adjustFontFallback: false,
});

const placa = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--fuente-placa",
  weight: ["500", "700"],
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: `${MARCA} · ${LEMA}`, template: `%s | ${MARCA}` },
  description: "Liquidaciones de gastos comunes, reservas, solicitudes, comunicados y aviso de emergencias del edificio.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2f5f57",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-UY" className={`${texto.variable} ${placa.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
