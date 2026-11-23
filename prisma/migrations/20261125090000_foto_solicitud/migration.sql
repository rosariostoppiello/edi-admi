-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN     "fotoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_fotoId_key" ON "solicitud"("fotoId");

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_fotoId_fkey" FOREIGN KEY ("fotoId") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

