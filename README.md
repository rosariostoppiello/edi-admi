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
Administración puede preparar octubre desde *Liquidación de gastos comunes →
Confección de la liquidación mensual → Crear borrador*.

## Pantallas
La estructura de pantallas y botones sigue [`docs/PROYECTO-EN-GRAFICO.md`](docs/PROYECTO-EN-GRAFICO.md):
seis teclas en el inicio y, en cada una, sus sub-botones (filtrados por permiso; si
alguien ve uno solo, entra directo). Teléfonos muestra sus sub-botones con el aviso
"en construcción" hasta su fase.

## Reserva de espacios comunes
- **Barbacoas:** calendario por semana (3 barbacoas × 2 turnos: mediodía 11–17 h y
  noche 19–2 h). Cada unidad ve libre/ocupado y sus reservas; Administración y
  Portería ven qué unidad reservó. Hasta 60 días de anticipación, 2 reservas activas
  por unidad, cancelación hasta 48 h antes (después, solo Administración).
- **Portería** reserva a pedido de una unidad: elige el código de la línea que paga y
  anota quién lo pidió.
- **Solarium:** no se reserva; está disponible si su barbacoa no está reservada.
- **Laundry:** informativo (tarjeta prepaga).
- **Configurar los espacios** (Administración, desde *Reserva de espacios comunes*):
  tarifa, reglas, texto del laundry, alta y baja.
- **Cobro:** en la confección, *Cargos del mes → Traer las reservas de barbacoa del
  mes* carga un cargo por reserva con la tarifa de la barbacoa, sin duplicar.

## Solicitudes varias
- **Aviso de desperfectos, Consultas de gastos comunes, Inquietudes varias:** cada
  una con su formulario y, abajo, "Mis solicitudes" con el estado y las respuestas.
- **Portería** la hace por sí misma o a pedido de una unidad (código + quién lo pidió).
- **Bandeja** (Administración; la Comisión, solo lectura): filtros por categoría y
  estado, respuestas (le llegan por mail al autor), cambio de estado y notas internas.
- Al crear, mail a la Administración y botón *Escribir por WhatsApp* (wa.me con el
  texto armado) si la Administración cargó su número en la bandeja.

## Comunicados de la Administración
- **Avisos importantes** y **Actas de asambleas** por fecha (lo último arriba);
  **Reglamentos** en el orden que elige la Administración.
- Solo la Administración publica, edita y da de baja (queda auditado). Cada
  comunicado lleva texto y/o un PDF de hasta 3 MB; al publicar un aviso o un acta se
  puede mandar por mail a todos (con el PDF adjunto).

## Liquidación mensual
- **Liquidación mensual** (todos): *Última liquidación* (recibo de la unidad, PDF y,
  para Administración y Comisión, el detalle por unidad) y *Liquidaciones anteriores*
  (las anuladas, marcadas).
- **Confección** (Administración): pantalla del borrador con las teclas **Egresos** e
  **Ingresos**, y además Cargos del mes, Cuotas por unidad, Fondos y textos y
  *Revisar y publicar*. Todo queda en borrador hasta publicar.
- **Columnas:** Saldo anterior, Pagos, Saldo, Intereses | G.C. unidad, G.C. garaje,
  Fondo de reserva, Cuota extra F.R., Barbacoas, Otros, Multas | Total a pagar.
- **Planilla de pagos** (.xlsx o .csv): una fila de encabezados con `Fecha`,
  `Unidad` y `Monto` (y opcional `Referencia`), en cualquier orden. Unidad con
  código completo (`2-201-A`, `2-301-P`, `2-301-I`); fecha `dd/mm/aaaa`; montos
  `1.234,50`. Si una fila tiene errores no se carga ninguna.
- **Planilla de egresos** (.xlsx o .csv): `Fecha | Rubro | Proveedor | Período | Monto`.
  Rubro es el código del subrubro (`3.3`); Período, a qué mes corresponde (`Agosto 2026`).
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
