-- AlterEnum
BEGIN;
-- Cuenta Corriente pasa a ser un medio de pago: las ventas que quedaron como CTA_CTE se recategorizan como FACTURA
UPDATE "ventas" SET "tipo_comprobante" = 'FACTURA' WHERE "tipo_comprobante"::text = 'CTA_CTE';
CREATE TYPE "TipoComprobante_new" AS ENUM ('FACTURA', 'REMITO');
ALTER TABLE "ventas" ALTER COLUMN "tipo_comprobante" DROP DEFAULT;
ALTER TABLE "ventas" ALTER COLUMN "tipo_comprobante" TYPE "TipoComprobante_new" USING ("tipo_comprobante"::text::"TipoComprobante_new");
ALTER TYPE "TipoComprobante" RENAME TO "TipoComprobante_old";
ALTER TYPE "TipoComprobante_new" RENAME TO "TipoComprobante";
DROP TYPE "TipoComprobante_old";
ALTER TABLE "ventas" ALTER COLUMN "tipo_comprobante" SET DEFAULT 'FACTURA';
COMMIT;

