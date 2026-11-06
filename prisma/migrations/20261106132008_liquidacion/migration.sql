-- CreateEnum
CREATE TYPE "ACargoDe" AS ENUM ('PROPIETARIO', 'INQUILINO');

-- CreateEnum
CREATE TYPE "Sufijo" AS ENUM ('A', 'P', 'I');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'PUBLICADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "OrigenIngreso" AS ENUM ('MANUAL', 'EXCEL', 'DEPOSITO');

-- CreateEnum
CREATE TYPE "TipoCargo" AS ENUM ('INTERES_OTRO', 'TAG', 'BARBACOA_OTROS', 'MULTA');

-- CreateEnum
CREATE TYPE "TipoImportacion" AS ENUM ('INGRESOS', 'SALDOS_INICIALES');

-- CreateEnum
CREATE TYPE "EstadoImportacion" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'DESCARTADA');

-- CreateEnum
CREATE TYPE "EstadoEnvio" AS ENUM ('PENDIENTE', 'ENVIADO', 'ERROR');

-- AlterTable
ALTER TABLE "unidad" ADD COLUMN     "garajeACargoDe" "ACargoDe" NOT NULL DEFAULT 'INQUILINO',
ADD COLUMN     "gcGaraje" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gcPropietario" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gcUnidad" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "direccion" TEXT NOT NULL DEFAULT '',
    "tasaInteresPb" INTEGER NOT NULL DEFAULT 100,
    "tasaFondoReservaPb" INTEGER NOT NULL DEFAULT 500,
    "diaVencimiento" INTEGER NOT NULL DEFAULT 25,
    "procedimientoPago" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "liquidacion" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "tasaInteresPb" INTEGER NOT NULL,
    "tasaFondoReservaPb" INTEGER NOT NULL,
    "diaVencimiento" INTEGER NOT NULL,
    "procedimientoPago" TEXT NOT NULL,
    "disponibilidades" JSONB,
    "rectificaId" TEXT,
    "publicadaEn" TIMESTAMP(3),
    "publicadaPorId" TEXT,
    "anuladaEn" TIMESTAMP(3),
    "anuladaPorId" TEXT,
    "motivoAnulacion" TEXT,
    "pdfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea_liquidacion" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "sufijo" "Sufijo" NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "saldoAnterior" INTEGER NOT NULL,
    "pagos" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "intereses" INTEGER NOT NULL,
    "gcUnidad" INTEGER NOT NULL,
    "gcGaraje" INTEGER NOT NULL,
    "fondoReserva" INTEGER NOT NULL,
    "tag" INTEGER NOT NULL,
    "barbacoaOtros" INTEGER NOT NULL,
    "multas" INTEGER NOT NULL,
    "saldoAPagar" INTEGER NOT NULL,

    CONSTRAINT "linea_liquidacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldo_inicial" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "sufijo" "Sufijo" NOT NULL,
    "monto" INTEGER NOT NULL,

    CONSTRAINT "saldo_inicial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingreso" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "sufijo" "Sufijo" NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "referencia" TEXT,
    "origen" "OrigenIngreso" NOT NULL,
    "importacionId" TEXT,
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacion" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "tipo" "TipoImportacion" NOT NULL,
    "archivoNombre" TEXT NOT NULL,
    "filas" JSONB NOT NULL,
    "errores" INTEGER NOT NULL,
    "estado" "EstadoImportacion" NOT NULL DEFAULT 'PENDIENTE',
    "usuarioId" TEXT,
    "confirmadaEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubro" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "padreId" TEXT,
    "cargoPropietario" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rubro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egreso" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "proveedor" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "fijoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "egreso_fijo" (
    "id" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "egreso_fijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_extra" (
    "id" TEXT NOT NULL,
    "liquidacionId" TEXT NOT NULL,
    "unidadId" TEXT NOT NULL,
    "sufijo" "Sufijo" NOT NULL,
    "tipo" "TipoCargo" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargo_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposito_no_identificado" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "forma" TEXT NOT NULL,
    "documento" TEXT,
    "monto" INTEGER NOT NULL,
    "cargadoEnId" TEXT NOT NULL,
    "identificadoEnId" TEXT,
    "ingresoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposito_no_identificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "datos" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envio_mail" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "refId" TEXT,
    "destinatario" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "estado" "EstadoEnvio" NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "enviadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envio_mail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_rectificaId_key" ON "liquidacion"("rectificaId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidacion_pdfId_key" ON "liquidacion"("pdfId");

-- CreateIndex
CREATE INDEX "liquidacion_periodo_estado_idx" ON "liquidacion"("periodo", "estado");

-- CreateIndex
CREATE INDEX "linea_liquidacion_unidadId_idx" ON "linea_liquidacion"("unidadId");

-- CreateIndex
CREATE UNIQUE INDEX "linea_liquidacion_liquidacionId_unidadId_sufijo_key" ON "linea_liquidacion"("liquidacionId", "unidadId", "sufijo");

-- CreateIndex
CREATE UNIQUE INDEX "saldo_inicial_liquidacionId_unidadId_sufijo_key" ON "saldo_inicial"("liquidacionId", "unidadId", "sufijo");

-- CreateIndex
CREATE INDEX "ingreso_liquidacionId_idx" ON "ingreso"("liquidacionId");

-- CreateIndex
CREATE UNIQUE INDEX "rubro_codigo_key" ON "rubro"("codigo");

-- CreateIndex
CREATE INDEX "egreso_liquidacionId_idx" ON "egreso"("liquidacionId");

-- CreateIndex
CREATE INDEX "cargo_extra_liquidacionId_idx" ON "cargo_extra"("liquidacionId");

-- CreateIndex
CREATE UNIQUE INDEX "deposito_no_identificado_ingresoId_key" ON "deposito_no_identificado"("ingresoId");

-- CreateIndex
CREATE INDEX "envio_mail_tipo_refId_estado_idx" ON "envio_mail"("tipo", "refId", "estado");

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_rectificaId_fkey" FOREIGN KEY ("rectificaId") REFERENCES "liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "liquidacion" ADD CONSTRAINT "liquidacion_pdfId_fkey" FOREIGN KEY ("pdfId") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_liquidacion" ADD CONSTRAINT "linea_liquidacion_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea_liquidacion" ADD CONSTRAINT "linea_liquidacion_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_inicial" ADD CONSTRAINT "saldo_inicial_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldo_inicial" ADD CONSTRAINT "saldo_inicial_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso" ADD CONSTRAINT "ingreso_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso" ADD CONSTRAINT "ingreso_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingreso" ADD CONSTRAINT "ingreso_importacionId_fkey" FOREIGN KEY ("importacionId") REFERENCES "importacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacion" ADD CONSTRAINT "importacion_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubro" ADD CONSTRAINT "rubro_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "rubro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso" ADD CONSTRAINT "egreso_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso" ADD CONSTRAINT "egreso_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso" ADD CONSTRAINT "egreso_fijoId_fkey" FOREIGN KEY ("fijoId") REFERENCES "egreso_fijo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "egreso_fijo" ADD CONSTRAINT "egreso_fijo_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "rubro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_extra" ADD CONSTRAINT "cargo_extra_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_extra" ADD CONSTRAINT "cargo_extra_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "unidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposito_no_identificado" ADD CONSTRAINT "deposito_no_identificado_cargadoEnId_fkey" FOREIGN KEY ("cargadoEnId") REFERENCES "liquidacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposito_no_identificado" ADD CONSTRAINT "deposito_no_identificado_identificadoEnId_fkey" FOREIGN KEY ("identificadoEnId") REFERENCES "liquidacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposito_no_identificado" ADD CONSTRAINT "deposito_no_identificado_ingresoId_fkey" FOREIGN KEY ("ingresoId") REFERENCES "ingreso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un solo período "vivo" (borrador o publicada): las anuladas quedan como historia.
CREATE UNIQUE INDEX "liquidacion_periodo_vigente_key" ON "liquidacion"("periodo") WHERE "estado" <> 'ANULADA';
-- Un solo borrador a la vez.
CREATE UNIQUE INDEX "liquidacion_un_borrador_key" ON "liquidacion"((true)) WHERE "estado" = 'BORRADOR';
-- Configuración: una sola fila.
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_una_fila" CHECK ("id" = 1);
