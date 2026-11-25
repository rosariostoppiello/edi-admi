import Link from "next/link";
import { Logo } from "@/componentes/ui/logo";

/** Pantallas sin sesión: login y recuperación de contraseña. */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sobre-pizarra bg-pizarra px-4 py-3 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/" className="inline-flex min-h-11 items-center hover:opacity-90">
            <Logo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
