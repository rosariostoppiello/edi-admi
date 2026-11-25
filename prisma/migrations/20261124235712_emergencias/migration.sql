-- CreateEnum
CREATE TYPE "TipoEmergencia" AS ENUM ('GAS', 'INCENDIO', 'AGUA', 'ASCENSOR', 'SEGURIDAD', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoEmergencia" AS ENUM ('ACTIVA', 'ATENDIDA', 'FALSA_ALARMA');

-- CreateTable
CREATE TABLE "emergencia" (
    "id" TEXT NOT NULL,
    "tipo" "TipoEmergencia" NOT NULL,
    "lugar" TEXT NOT NULL DEFAULT '',
    "detalle" TEXT NOT NULL DEFAULT '',
    "autorId" TEXT NOT NULL,
    "unidadId" TEXT,
    "estado" "EstadoEmergencia" NOT NULL DEFAULT 'ACTIVA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "difundidaEn" TIMESTAMP(3),
    "difundidaPorId" TEXT,
    "mensajeGeneral" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" TEXT,
    "nota" TEXT,

    CONSTRAINT "emergencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergencia_estado_creadaEn_idx" ON "emergencia"("estado", "creadaEn");

-- CreateIndex
CREATE INDEX "emergencia_autorId_creadaEn_idx" ON "emergencia"("autorId", "creadaEn");

-- AddForeignKey
ALTER TABLE "emergencia" ADD CONSTRAINT "emergencia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencia" ADD CONSTRAINT "emergencia_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencia" ADD CONSTRAINT "emergencia_difundidaPorId_fkey" FOREIGN KEY ("difundidaPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergencia" ADD CONSTRAINT "emergencia_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
