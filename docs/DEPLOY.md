# Deploy a producción (Vercel + Neon)

> **No se hace sin el OK explícito** de quien administra el proyecto. Antes, confirmar
> con el asesor dónde se guardan los datos (Ley 18.331, decisión 18): la región por
> defecto es São Paulo (`gru1` en `vercel.json`; en Neon, elegir `sa-east-1`).

## Qué se usa
- **Vercel** (Next.js 16, Node.js). `npm run vercel-build` genera el cliente de Prisma,
  aplica las migraciones pendientes (`prisma migrate deploy`) y compila.
- **Neon Postgres** desde el Marketplace de Vercel: carga `DATABASE_URL` (pooler) y la
  directa (`DATABASE_URL_UNPOOLED`), que usan las migraciones.
- **Gmail por SMTP** para el mail (decisión 77): la cuenta de la Administración y una
  contraseña de aplicación de Google. Gmail permite unos 500 mails por día, suficiente
  para el edificio. (Si más adelante hay un dominio propio, se puede pasar a Resend.)
- **Archivos** (PDF de liquidaciones y comunicados): en la base, tabla `archivo`
  (decisión 28). Alcanza para ~12 liquidaciones y algunos comunicados por año. Si
  crece, se pasa a Vercel Blob detrás de la misma interfaz (no hace falta ahora).

## Pasos
1. Crear el proyecto en Vercel desde el repositorio (rama de producción: `main`, cuando exista).
2. Marketplace → Neon → crear la base en la región acordada y conectarla al proyecto.
3. Variables de entorno (Production y Preview), ver `.env.example`:
   - `DATABASE_URL`, `DIRECT_URL` (de Neon)
   - `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (`https://dominio`)
   - `EDIFICIO_NOMBRE` (nombre del primer edificio; los demás se cargan desde la app)
   - `MAIL_DRIVER=smtp`, `MAIL_FROM` (el nombre que se ve), `SMTP_USER` (la cuenta de
     Gmail) y `SMTP_PASS` (contraseña de aplicación de Google, no la clave de la cuenta)
   - `CRON_SECRET` (cualquier texto largo y aleatorio)
   - **No** cargar `SEED_PASSWORD`: en producción no se corre el seed.

### Demo con datos inventados
Igual que arriba, pero se corre el seed contra la base de la demo
(`DATABASE_URL=… SEED_PASSWORD=… npm run db:seed`) y se comparten los usuarios de prueba.
Como todos los mails del seed son `@example.com`, no sale ningún mail real.
4. Deploy. La primera vez crea todas las tablas (migraciones).
5. Crear el primer usuario de Administración (con la `DATABASE_URL` de producción en el entorno):
   `npm run admin:crear -- "Nombre Apellido" mail@dominio`. Esa persona entra a
   `/ingresar` → "Me olvidé la contraseña" y crea su clave con el mail que le llega.
   Para que pueda aprobar edificios nuevos, marcala como dueña del sistema:
   `npm run dueno:crear -- mail@dominio`.
6. Desde la app, Administración carga torres y unidades (o se importan), los datos de
   Teléfonos, los espacios de Reservas y la primera liquidación con los saldos iniciales.

## Después
- Logs: Vercel → Logs. Los errores de pantalla muestran un código (`digest`) para buscarlos.
- Mails con error: se reintentan desde la liquidación o el comunicado.
- Cron: Vercel → Cron Jobs (`/api/cron/seguro`, todos los días a las 9 h de Uruguay).
