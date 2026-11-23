-- Fase 4: columnas de la liquidación según "Proyecto en gráfico" (docs/PLAN.md, decisiones 33 y 34)
-- y tabla mínima de solicitudes (aviso de venta de la unidad).

-- CreateEnum
CREATE TYPE "CategoriaSolicitud" AS ENUM ('DESPERFECTO', 'CONSULTA_GC', 'INQUIETUD', 'VENTA_UNIDAD');
CREATE TYPE "OrigenSolicitud" AS ENUM ('UNIDAD', 'PORTERIA_PROPIA', 'PORTERIA_A_PEDIDO');
CREATE TYPE "EstadoSolicitud" AS ENUM ('NUEVA', 'EN_CURSO', 'RESUELTA');

-- Cargos: Tag, Barbacoa/otros y los ajustes de "Intereses y otros" pasan a OTROS.
CREATE TYPE "TipoCargo_new" AS ENUM ('BARBACOAS', 'OTROS', 'MULTA');
ALTER TABLE "cargo_extra" ALTER COLUMN "tipo" TYPE "TipoCargo_new"
  USING (CASE WHEN "tipo"::text = 'MULTA' THEN 'MULTA' ELSE 'OTROS' END)::"TipoCargo_new";
ALTER TYPE "TipoCargo" RENAME TO "TipoCargo_old";
ALTER TYPE "TipoCargo_new" RENAME TO "TipoCargo";
DROP TYPE "TipoCargo_old";

-- AlterEnum
ALTER TYPE "TipoImportacion" ADD VALUE 'EGRESOS';

-- Líneas publicadas: se conserva la foto. Tag + Barbacoa/otros van a Otros;
-- los intereses guardados no se tocan (en las viejas incluían los ajustes).
ALTER TABLE "linea_liquidacion"
  ADD COLUMN "cuotaExtraFr" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "barbacoas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "otros" INTEGER NOT NULL DEFAULT 0;
UPDATE "linea_liquidacion" SET "otros" = "tag" + "barbacoaOtros";
ALTER TABLE "linea_liquidacion" DROP COLUMN "tag", DROP COLUMN "barbacoaOtros";

-- Cuota extra del fondo de reserva por unidad
ALTER TABLE "unidad" ADD COLUMN "cuotaExtraFr" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "solicitud" (
    "id" TEXT NOT NULL,
    "unidadId" TEXT,
    "autorId" TEXT NOT NULL,
    "categoria" "CategoriaSolicitud" NOT NULL,
    "origen" "OrigenSolicitud" NOT NULL DEFAULT 'UNIDAD',
    "asunto" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'NUEVA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitud_unidadId_categoria_estado_idx" ON "solicitud"("unidadId", "categoria", "estado");
CREATE INDEX "solicitud_estado_creadaEn_idx" ON "solicitud"("estado", "creadaEn");

ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
