"use client";

/** Error en el layout raíz: página mínima con su propio documento (no carga los estilos globales). */
export default function ErrorGlobal({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-UY">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eceee9", color: "#1f2830", margin: 0 }}>
        <main style={{ maxWidth: "32rem", margin: "0 auto", padding: "4rem 1rem", lineHeight: 1.5 }}>
          <title>Algo salió mal | Gastos comunes</title>
          <h1 style={{ fontSize: "1.75rem" }}>Algo salió mal</h1>
          <p>No pudimos cargar el sistema. Probá de nuevo en un momento.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 48, padding: "0 1.25rem", fontWeight: 700, fontSize: "1rem", background: "#7a5a12", color: "#fff", border: 0, borderRadius: 8 }}
          >
            Probar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}
