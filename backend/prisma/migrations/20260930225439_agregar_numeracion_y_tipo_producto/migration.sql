-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('REPUESTO', 'MAQUINARIA');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "tipo_producto" "TipoProducto" NOT NULL DEFAULT 'REPUESTO';

-- AlterTable
ALTER TABLE "servicios_tecnicos" ADD COLUMN     "numero" INTEGER;

-- AlterTable: se agrega nullable, se completa con el id (así se conserva el número que ya se imprimió
-- en cada comprobante existente) y recién ahora se exige NOT NULL
ALTER TABLE "ventas" ADD COLUMN     "numero" INTEGER;
UPDATE "ventas" SET "numero" = "id" WHERE "numero" IS NULL;
ALTER TABLE "ventas" ALTER COLUMN "numero" SET NOT NULL;

-- CreateTable
CREATE TABLE "correlativos" (
    "tipo" TEXT NOT NULL,
    "ultimo_numero" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "correlativos_pkey" PRIMARY KEY ("tipo")
);

-- Los servicios técnicos finalizados también venían numerándose por su id
UPDATE "servicios_tecnicos" SET "numero" = "id" WHERE "estado" = 'FINALIZADO' AND "numero" IS NULL;

-- A partir de ahora Factura y Remito sacan número de su propia secuencia (compartida entre
-- Ventas y Servicios Técnicos); se arranca después del mayor número ya impreso de cada tipo
INSERT INTO "correlativos" ("tipo", "ultimo_numero")
SELECT 'FACTURA', COALESCE((
  SELECT GREATEST(
    (SELECT MAX("numero") FROM "ventas" WHERE "tipo_comprobante" = 'FACTURA'),
    (SELECT MAX("numero") FROM "servicios_tecnicos" WHERE "tipo_comprobante" = 'FACTURA')
  )
), 0);

INSERT INTO "correlativos" ("tipo", "ultimo_numero")
SELECT 'REMITO', COALESCE((
  SELECT GREATEST(
    (SELECT MAX("numero") FROM "ventas" WHERE "tipo_comprobante" = 'REMITO'),
    (SELECT MAX("numero") FROM "servicios_tecnicos" WHERE "tipo_comprobante" = 'REMITO')
  )
), 0);

INSERT INTO "correlativos" ("tipo", "ultimo_numero") VALUES ('PRESUPUESTO', 0);
