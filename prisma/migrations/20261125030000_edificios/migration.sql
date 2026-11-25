-- Varios edificios (decisión 85). Todo lo existente pasa al edificio "edificio-principal".

CREATE TYPE "EstadoEdificio" AS ENUM ('PENDIENTE', 'ACTIVO', 'RECHAZADO', 'BAJA');

CREATE TABLE "edificio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT NOT NULL DEFAULT '',
    "estado" "EstadoEdificio" NOT NULL DEFAULT 'ACTIVO',
    "modulos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "edificio_pkey" PRIMARY KEY ("id")
);

-- El primer edificio toma la dirección de la configuración (si había una).
INSERT INTO "edificio" ("id", "nombre", "direccion")
SELECT 'edificio-principal', 'Complejo', COALESCE((SELECT "direccion" FROM "configuracion" LIMIT 1), '');

-- Índices únicos que pasan a ser por edificio
DROP INDEX "torre_nombre_key";
DROP INDEX "rubro_codigo_key";
DROP INDEX "espacio_nombre_key";
DROP INDEX "liquidacion_periodo_vigente_key";
DROP INDEX "liquidacion_un_borrador_key";

-- Torres: el código queda como clave interna y se agrega el número que ve la gente.
CREATE SEQUENCE torre_codigo_seq;
ALTER TABLE "torre" ADD COLUMN "color" TEXT NOT NULL DEFAULT '',
ADD COLUMN "edificioId" TEXT,
ADD COLUMN "numero" INTEGER,
ALTER COLUMN "codigo" SET DEFAULT nextval('torre_codigo_seq');
ALTER SEQUENCE torre_codigo_seq OWNED BY "torre"."codigo";
-- Las torres nuevas toman códigos internos altos (no chocan con los actuales).
SELECT setval('torre_codigo_seq', GREATEST(1000, COALESCE((SELECT MAX("codigo") FROM "torre"), 0) + 1), false);
UPDATE "torre" SET "numero" = "codigo";
-- Colores de marca de las torres del primer edificio (tokens de docs/design.md).
UPDATE "torre" SET "color" = CASE "codigo"
  WHEN 2 THEN 'var(--torre-avenue)'
  WHEN 3 THEN 'var(--torre-sky)'
  WHEN 4 THEN 'var(--torre-pilay)'
  WHEN 5 THEN 'var(--torre-ne)'
  WHEN 6 THEN 'var(--torre-garajes)'
  ELSE '' END;

-- Columna edificioId en las tablas raíz, con lo existente en el edificio principal
ALTER TABLE "unidad" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "liquidacion" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "rubro" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "solicitud" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "espacio" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "comunicado" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "contacto" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "poliza" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "emergencia" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "pedido_acceso" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "ficha_contacto" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "configuracion" ADD COLUMN "edificioId" TEXT;
ALTER TABLE "auditoria" ADD COLUMN "edificioId" TEXT;

UPDATE "torre" SET "edificioId" = 'edificio-principal';
UPDATE "unidad" SET "edificioId" = 'edificio-principal';
UPDATE "liquidacion" SET "edificioId" = 'edificio-principal';
UPDATE "rubro" SET "edificioId" = 'edificio-principal';
UPDATE "solicitud" SET "edificioId" = 'edificio-principal';
UPDATE "espacio" SET "edificioId" = 'edificio-principal';
UPDATE "comunicado" SET "edificioId" = 'edificio-principal';
UPDATE "contacto" SET "edificioId" = 'edificio-principal';
UPDATE "poliza" SET "edificioId" = 'edificio-principal';
UPDATE "emergencia" SET "edificioId" = 'edificio-principal';
UPDATE "pedido_acceso" SET "edificioId" = 'edificio-principal';
UPDATE "ficha_contacto" SET "edificioId" = 'edificio-principal';
UPDATE "configuracion" SET "edificioId" = 'edificio-principal';
UPDATE "auditoria" SET "edificioId" = 'edificio-principal';

ALTER TABLE "torre" ALTER COLUMN "edificioId" SET NOT NULL, ALTER COLUMN "numero" SET NOT NULL;
ALTER TABLE "unidad" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "liquidacion" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "rubro" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "solicitud" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "espacio" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "comunicado" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "contacto" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "poliza" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "emergencia" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "pedido_acceso" ALTER COLUMN "edificioId" SET NOT NULL;

-- Ficha de contacto y configuración: una por edificio
ALTER TABLE "ficha_contacto" DROP CONSTRAINT "ficha_contacto_pkey";
ALTER TABLE "ficha_contacto" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "ficha_contacto" ADD CONSTRAINT "ficha_contacto_pkey" PRIMARY KEY ("edificioId", "clave");

ALTER TABLE "configuracion" DROP CONSTRAINT "configuracion_pkey";
ALTER TABLE "configuracion" DROP COLUMN "id";
ALTER TABLE "configuracion" ALTER COLUMN "edificioId" SET NOT NULL;
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_pkey" PRIMARY KEY ("edificioId");

-- Únicos por edificio
CREATE UNIQUE INDEX "torre_edificioId_numero_key" ON "torre"("edificioId", "numero");
CREATE UNIQUE INDEX "torre_edificioId_nombre_key" ON "torre"("edificioId", "nombre");
CREATE UNIQUE INDEX "rubro_edificioId_codigo_key" ON "rubro"("edificioId", "codigo");
CREATE UNIQUE INDEX "espacio_edificioId_nombre_key" ON "espacio"("edificioId", "nombre");
-- Un solo período no anulado y un solo borrador a la vez, por edificio.
CREATE UNIQUE INDEX "liquidacion_periodo_vigente_key" ON "liquidacion"("edificioId", "periodo") WHERE "estado" <> 'ANULADA';
CREATE UNIQUE INDEX "liquidacion_un_borrador_key" ON "liquidacion"("edificioId") WHERE "estado" = 'BORRADOR';

-- Claves foráneas
ALTER TABLE "torre" ADD CONSTRAINT "torre_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unidad" ADD CONSTRAINT "unidad_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rubro" ADD CONSTRAINT "rubro_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "espacio" ADD CONSTRAINT "espacio_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comunicado" ADD CONSTRAINT "comunicado_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ficha_contacto" ADD CONSTRAINT "ficha_contacto_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emergencia" ADD CONSTRAINT "emergencia_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pedido_acceso" ADD CONSTRAINT "pedido_acceso_edificioId_fkey" FOREIGN KEY ("edificioId") REFERENCES "edificio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índices para filtrar por edificio
CREATE INDEX "unidad_edificioId_idx" ON "unidad"("edificioId");
CREATE INDEX "solicitud_edificioId_idx" ON "solicitud"("edificioId");
CREATE INDEX "emergencia_edificioId_idx" ON "emergencia"("edificioId");
CREATE INDEX "comunicado_edificioId_idx" ON "comunicado"("edificioId");
CREATE INDEX "auditoria_edificioId_idx" ON "auditoria"("edificioId");
