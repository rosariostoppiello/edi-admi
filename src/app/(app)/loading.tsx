/** Estado de carga: un esqueleto con la forma de una pantalla de teclas (docs/design.md, Estados). */
export default function Cargando() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Cargando…</span>
      <div aria-hidden="true">
        <div className="h-5 w-40 rounded bg-junta" />
        <div className="mt-6 h-9 w-72 max-w-full rounded bg-junta" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-[var(--radius-tecla)] border border-junta bg-losa" />
          ))}
        </div>
      </div>
    </div>
  );
}
