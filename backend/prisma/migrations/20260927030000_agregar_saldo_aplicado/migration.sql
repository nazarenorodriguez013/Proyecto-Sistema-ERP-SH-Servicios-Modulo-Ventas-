-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "saldo_aplicado" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "servicios_tecnicos" ADD COLUMN     "saldo_aplicado" DOUBLE PRECISION NOT NULL DEFAULT 0;

