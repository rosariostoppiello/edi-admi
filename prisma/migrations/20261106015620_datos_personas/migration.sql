-- AlterTable
ALTER TABLE "persona" ADD COLUMN     "datosConfirmadosEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "destinatario_extra" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "nombre" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "destinatario_extra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destinatario_extra_unidadId_email_key" ON "destinatario_extra"("unidadId", "email");

-- AddForeignKey
ALTER TABLE "destinatario_extra" ADD CONSTRAINT "destinatario_extra_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
