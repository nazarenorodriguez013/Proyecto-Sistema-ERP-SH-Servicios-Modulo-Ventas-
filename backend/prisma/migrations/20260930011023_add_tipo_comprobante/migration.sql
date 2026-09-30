-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA', 'REMITO', 'CTA_CTE');

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "tipo_comprobante" "TipoComprobante" NOT NULL DEFAULT 'FACTURA';

