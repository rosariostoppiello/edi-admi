-- CreateEnum
CREATE TYPE "TipoEventoSolicitud" AS ENUM ('RESPUESTA', 'CAMBIO_ESTADO', 'NOTA_INTERNA');

-- AlterTable
ALTER TABLE "configuracion" ADD COLUMN     "whatsapp" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN     "pedidaPor" TEXT;

-- CreateTable
CREATE TABLE "solicitud_evento" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoEventoSolicitud" NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_evento_solicitudId_fecha_idx" ON "solicitud_evento"("solicitudId", "fecha");

-- AddForeignKey
ALTER TABLE "solicitud_evento" ADD CONSTRAINT "solicitud_evento_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_evento" ADD CONSTRAINT "solicitud_evento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

