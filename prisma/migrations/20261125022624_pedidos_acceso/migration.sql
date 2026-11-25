-- CreateEnum
CREATE TYPE "EstadoPedidoAcceso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "pedido_acceso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "calidad" "Calidad" NOT NULL,
    "mensaje" TEXT NOT NULL DEFAULT '',
    "estado" "EstadoPedidoAcceso" NOT NULL DEFAULT 'PENDIENTE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltoEn" TIMESTAMP(3),
    "resueltoPorId" TEXT,
    "motivo" TEXT,

    CONSTRAINT "pedido_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pedido_acceso_estado_creadoEn_idx" ON "pedido_acceso"("estado", "creadoEn");

-- CreateIndex
CREATE INDEX "pedido_acceso_email_estado_idx" ON "pedido_acceso"("email", "estado");

-- AddForeignKey
ALTER TABLE "pedido_acceso" ADD CONSTRAINT "pedido_acceso_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_acceso" ADD CONSTRAINT "pedido_acceso_resueltoPorId_fkey" FOREIGN KEY ("resueltoPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
