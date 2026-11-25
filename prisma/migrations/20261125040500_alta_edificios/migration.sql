-- AlterEnum
ALTER TYPE "TipoEspacio" ADD VALUE 'PISCINA';

-- AlterTable
ALTER TABLE "edificio" ADD COLUMN     "motivoRechazo" TEXT,
ADD COLUMN     "revisadoEn" TIMESTAMP(3),
ADD COLUMN     "revisadoPorId" TEXT,
ADD COLUMN     "solicitadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "edificio" ADD CONSTRAINT "edificio_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edificio" ADD CONSTRAINT "edificio_revisadoPorId_fkey" FOREIGN KEY ("revisadoPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

