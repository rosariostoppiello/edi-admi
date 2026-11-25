-- AlterEnum
ALTER TYPE "EstadoPedidoAcceso" ADD VALUE 'SIN_VERIFICAR';

-- AlterTable
ALTER TABLE "pedido_acceso" ADD COLUMN     "apellido" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "codigoHash" TEXT,
ADD COLUMN     "codigoVence" TIMESTAMP(3),
ADD COLUMN     "intentos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "persona" ADD COLUMN     "apellido" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "aviso_venta" (
    "id" TEXT NOT NULL,
    "solicitudId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "calidad" "Calidad" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aviso_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aviso_venta_solicitudId_key" ON "aviso_venta"("solicitudId");

-- AddForeignKey
ALTER TABLE "aviso_venta" ADD CONSTRAINT "aviso_venta_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Nombre y apellido por separado: lo existente se parte en el primer espacio
-- (cada persona lo puede corregir desde "Editar mis datos").
UPDATE "persona"
SET "apellido" = substr("nombre", strpos("nombre", ' ') + 1),
    "nombre" = split_part("nombre", ' ', 1)
WHERE strpos("nombre", ' ') > 0;
UPDATE "pedido_acceso"
SET "apellido" = substr("nombre", strpos("nombre", ' ') + 1),
    "nombre" = split_part("nombre", ' ', 1)
WHERE strpos("nombre", ' ') > 0;
