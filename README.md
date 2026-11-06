# Gastos comunes — sistema de administración del edificio

Liquidación de gastos comunes, reservas de espacios, datos de propietarios e
inquilinos, teléfonos útiles, solicitudes y comunicados para un complejo en
propiedad horizontal (Uruguay).

Stack: Next.js 16 (App Router) + TypeScript, PostgreSQL + Prisma 7, Better Auth,
Tailwind 4, Zod, Vitest y Playwright.

## Requisitos
- Node.js 22
- PostgreSQL 14 o superior

## Instalación

```bash
npm install                      # también genera el cliente de Prisma
cp .env.example .env             # completá los valores (ver abajo)
createdb ediadmi_dev
createdb ediadmi_test            # solo para los tests e2e
npm run db:migrate               # aplica las migraciones
npm run db:seed                  # carga datos FICTICIOS de prueba
npm run dev                      # http://localhost:3000
```

### Variables de entorno

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Base de desarrollo / producción |
| `DATABASE_URL_TEST` | Base para los e2e (se borra y recarga en cada corrida) |
| `BETTER_AUTH_SECRET` | Secreto de sesiones, mínimo 32 caracteres: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | URL pública de la app |
| `MAIL_DRIVER` | `archivo` (guarda los mails en `storage/mails/`, no sale nada) o `resend` (pendiente) |
| `MAIL_FROM` | Remitente de los mails |
| `RESEND_API_KEY` | Clave de Resend, cuando se configure el dominio |
| `SEED_PASSWORD` | Contraseña de los usuarios de prueba del seed (solo desarrollo) |
| `EDIFICIO_NOMBRE` | Nombre del complejo en la cabecera (opcional) |

### Usuarios de prueba (seed)
Todos usan la clave de `SEED_PASSWORD`:
- `admin@example.com` — Administración
- `porteria@example.com` — Portería
- `comision@example.com` — Comisión administradora (sin unidad)
- `laura.pereira.1@example.com` — Comisión + propietaria de 2-101 y de un garaje
- Un usuario por cada propietario/inquilino del seed (ver `prisma/seed.ts`)

El seed deja publicada la liquidación de **setiembre 2026** (ficticia), así que
Administración puede preparar octubre desde *Liquidación → Preparar octubre*.

## Liquidación mensual
- **Confección** (Administración), en 6 pasos: ingresos, egresos, cargos extra,
  cuotas, fondos y textos, revisar y publicar. Todo queda en borrador hasta publicar.
- **Planilla de pagos** (.xlsx o .csv): una fila de encabezados con `Fecha`,
  `Unidad` y `Monto` (y opcional `Referencia`), en cualquier orden. Unidad con
  código completo (`2-201-A`, `2-301-P`, `2-301-I`); fecha `dd/mm/aaaa`; montos
  `1.234,50`. Si una fila tiene errores no se carga ninguna.
- **Primera liquidación:** los saldos anteriores se cargan con una planilla
  `Unidad | Saldo` (negativo = saldo a favor).
- **Publicar** genera el PDF y manda un mail a cada destinatario con su saldo y el
  PDF adjunto. En desarrollo los mails quedan en `storage/mails/`.
- **Anular** (solo la última publicada, con motivo) abre una copia en borrador que
  se publica como *rectificada*.

## Tests

```bash
npm test                         # unitarios: dinero, códigos, permisos, liquidación, planillas
npm run build && npm run test:e2e   # e2e en móvil (390 px) y escritorio (1280 px)
```

La primera vez: `npx playwright install chromium`.

## Datos reales
La carpeta `docs/` puede contener liquidaciones y planillas reales del edificio.
Están excluidas de git (`.gitignore`) y **no** se usan en el seed ni en los tests.

## Deploy
Se documenta en la Fase 8 (objetivo: Vercel + Neon Postgres + Vercel Blob; la ubicación
de los datos queda a confirmar con el asesor por la Ley 18.331).
