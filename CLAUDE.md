@AGENTS.md

# Sistema de gastos comunes — convenciones

App web para administrar y liquidar los gastos comunes de un complejo en propiedad
horizontal (Uruguay). Plan y decisiones: `docs/PLAN.md`. Diseño: `docs/design.md`.

## Comandos
- `npm run dev` — desarrollo (http://localhost:3000)
- `npm test` — tests unitarios (Vitest)
- `npm run build && npm run test:e2e` — e2e (Playwright, base `DATABASE_URL_TEST`, puerto 3100)
- `npm run lint` · `npm run typecheck`
- `npm run db:migrate` — nueva migración · `npm run db:seed` — datos ficticios
- `npx prisma generate` — regenerar el cliente (sale en `src/generated/`, no se versiona)

## Reglas del proyecto
- **Idioma:** interfaz en español rioplatense (vos). Código de dominio en español; las
  tablas de Better Auth (`user`, `session`…) quedan en inglés por la librería.
- **Dinero:** siempre enteros en centésimos (`src/dominio/dinero.ts`). Nunca floats,
  nunca `parseFloat` sobre montos. Intereses y FR se redondean al peso.
- **Códigos de unidad:** `{torre}-{nro}-{A|P|I}` (`src/dominio/codigos.ts`).
- **Permisos:** toda server action, route handler y página que lea datos llama a
  `exigirPermiso(accion, recurso)` de `src/servidor/sesion.ts`. La matriz vive en
  `src/dominio/permisos.ts` y se testea en `tests/unit/permisos.test.ts`; si agregás una
  acción, agregala a la matriz del test (el test falla si falta).
- **Consultas por unidad:** filtrar siempre por las unidades del actor; nunca confiar en
  un `unidadId` que venga del cliente sin pasar por `exigirPermiso`.
- **Validación:** Zod en servidor para toda entrada.
- **Auditoría:** acciones sensibles (publicar/anular liquidación, cambios de datos,
  bajas, contraseñas) llaman a `registrarAuditoria()`, dentro de la misma transacción.
- **Datos personales (Ley 18.331):** no exponer teléfonos ni mails entre unidades;
  Portería ve solo código + nombre del ocupante.
- **Datos reales:** `docs/` tiene documentos con datos reales del edificio y están en
  `.gitignore`. Nunca copiar esos datos al seed, a tests, a commits ni a consultas
  externas. El seed usa solo datos ficticios (`@example.com`).
- **UI:** seguir `docs/design.md` (tokens en `src/app/globals.css`, componentes en
  `src/componentes/ui`). Mobile-first, áreas táctiles ≥ 44 px, contraste AA, foco visible.
- **Next.js 16:** Cache Components está desactivado a propósito (renderizado dinámico).
  `src/proxy.ts` solo hace la redirección optimista al login; la validación real está
  en el servidor.
- **Simple antes que complejo:** sin colas ni workers; mails por lotes al publicar.
- **Liquidación publicada = inmutable:** toda escritura de la confección pasa por
  `enBorrador()` (bloquea la fila y exige estado BORRADOR). Para corregir, se anula.
- **Dentro de una transacción**, consultas en serie (no `Promise.all` sobre `tx`).
- **Fechas y horas:** las fechas de calendario son texto `AAAA-MM-DD`; los horarios
  (turnos, plazos) se calculan en hora de Uruguay con `dominio/reservas.ts`.
- **Módulos `"use client"`:** exportan solo componentes. Las constantes que use una
  página de servidor van en un archivo común (ej. `confeccion/tipos-cargo.ts`).
- **Pantallas y botones:** la fuente de verdad es `docs/PROYECTO-EN-GRAFICO.md`. Los
  módulos y sub-botones viven en `src/app/(app)/modulos.ts` (orden del gráfico, filtro por
  permiso) y se muestran con `PantallaTeclas` (`componentes/ui/pantalla-teclas.tsx`).

## Estructura
- `src/dominio/` lógica pura y testeable (sin DB ni Next); `dominio/liquidacion/` tiene el cálculo,
  el resumen por rubro, las disponibilidades y la validación de planillas; `dominio/reservas.ts` las
  reglas de reserva (turnos, 48 h, anticipación, máximo por unidad, solarium)
- `src/servidor/` db, auth, sesión/permisos, auditoría, mail; `servidor/liquidacion/` confección,
  importación, publicación (PDF + envío) y consulta; `servidor/reservas.ts` reservas y espacios
- `src/app/(publico)/` login y recuperación · `src/app/(app)/` pantallas con sesión
- `src/componentes/ui/` sistema de diseño
- `prisma/` esquema, migraciones y seed · `tests/unit`, `tests/e2e`
