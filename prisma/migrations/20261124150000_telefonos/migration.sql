-- CreateEnum
CREATE TYPE "TipoContacto" AS ENUM ('COMISION', 'EMPRESA', 'SERVICIO');

-- CreateTable
CREATE TABLE "ficha_contacto" (
    "clave" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "actualizada" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ficha_contacto_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "contacto" (
    "id" TEXT NOT NULL,
    "tipo" "TipoContacto" NOT NULL,
    "nombre" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "unidad" TEXT NOT NULL DEFAULT '',
    "cuenta" TEXT NOT NULL DEFAULT '',
    "titular" TEXT NOT NULL DEFAULT '',
    "consentimientoEn" TIMESTAMP(3),
    "consentimientoRegistradoPorId" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poliza" (
    "id" TEXT NOT NULL,
    "aseguradora" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "cobertura" TEXT NOT NULL DEFAULT '',
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "telefono" TEXT NOT NULL DEFAULT '',
    "avisoVencimientoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poliza_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacto_tipo_orden_idx" ON "contacto"("tipo", "orden");

-- AddForeignKey
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_consentimientoRegistradoPorId_fkey" FOREIGN KEY ("consentimientoRegistradoPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

