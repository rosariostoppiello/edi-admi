/** Pantallas sin sesión: login y recuperación de contraseña. */
export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sobre-pizarra bg-pizarra px-4 py-4 text-white">
        <p className="mx-auto max-w-md text-medio font-bold">Gastos comunes del edificio</p>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
