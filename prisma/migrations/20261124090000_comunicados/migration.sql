-- CreateEnum
CREATE TYPE "TipoComunicado" AS ENUM ('AVISO', 'REGLAMENTO', 'ACTA');

-- CreateTable
CREATE TABLE "comunicado" (
    "id" TEXT NOT NULL,
    "tipo" "TipoComunicado" NOT NULL,
    "titulo" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "cuerpo" TEXT NOT NULL DEFAULT '',
    "archivoId" TEXT,
    "publicadoPorId" TEXT NOT NULL,
    "enviadoPorMail" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comunicado_archivoId_key" ON "comunicado"("archivoId");

-- CreateIndex
CREATE INDEX "comunicado_tipo_activo_fecha_idx" ON "comunicado"("tipo", "activo", "fecha");

-- AddForeignKey
ALTER TABLE "comunicado" ADD CONSTRAINT "comunicado_archivoId_fkey" FOREIGN KEY ("archivoId") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicado" ADD CONSTRAINT "comunicado_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

