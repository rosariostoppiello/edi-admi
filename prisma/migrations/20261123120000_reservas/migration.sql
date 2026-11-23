-- CreateEnum
CREATE TYPE "TipoEspacio" AS ENUM ('BARBACOA', 'SOLARIUM', 'LAUNDRY', 'OTRO');

-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('MEDIODIA', 'NOCHE');

-- CreateEnum
CREATE TYPE "OrigenReserva" AS ENUM ('UNIDAD', 'PORTERIA_A_PEDIDO', 'ADMINISTRACION');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('ACTIVA', 'CANCELADA');

-- AlterTable
ALTER TABLE "cargo_extra" ADD COLUMN     "reservaId" TEXT;

-- CreateTable
CREATE TABLE "espacio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEspacio" NOT NULL,
    "torreId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "tarifa" INTEGER NOT NULL DEFAULT 0,
    "reglas" JSONB,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "barbacoaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "espacio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reserva" (
    "id" TEXT NOT NULL,
    "espacioId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "turno" "Turno" NOT NULL,
    "unidadId" TEXT NOT NULL,
    "sufijo" "Sufijo" NOT NULL,
    "creadaPorId" TEXT NOT NULL,
    "origen" "OrigenReserva" NOT NULL,
    "pedidaPor" TEXT,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'ACTIVA',
    "canceladaPorId" TEXT,
    "canceladaEn" TIMESTAMP(3),
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserva_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "espacio_nombre_key" ON "espacio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "espacio_barbacoaId_key" ON "espacio"("barbacoaId");

-- CreateIndex
CREATE INDEX "reserva_espacioId_fecha_idx" ON "reserva"("espacioId", "fecha");

-- CreateIndex
CREATE INDEX "reserva_unidadId_estado_idx" ON "reserva"("unidadId", "estado");

-- CreateIndex
CREATE INDEX "cargo_extra_reservaId_idx" ON "cargo_extra"("reservaId");

-- AddForeignKey
ALTER TABLE "cargo_extra" ADD CONSTRAINT "cargo_extra_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacio" ADD CONSTRAINT "espacio_torreId_fkey" FOREIGN KEY ("torreId") REFERENCES "torre"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "espacio" ADD CONSTRAINT "espacio_barbacoaId_fkey" FOREIGN KEY ("barbacoaId") REFERENCES "espacio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_espacioId_fkey" FOREIGN KEY ("espacioId") REFERENCES "espacio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_canceladaPorId_fkey" FOREIGN KEY ("canceladaPorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Un solo turno ACTIVO por espacio y fecha: la base impide la doble reserva
-- aunque dos personas confirmen a la vez.
CREATE UNIQUE INDEX "reserva_activa_unica" ON "reserva"("espacioId", "fecha", "turno") WHERE "estado" = 'ACTIVA';
