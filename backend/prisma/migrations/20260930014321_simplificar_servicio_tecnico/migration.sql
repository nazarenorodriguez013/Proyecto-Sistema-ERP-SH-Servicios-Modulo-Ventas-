-- CreateEnum
CREATE TYPE "EstadoRetiro" AS ENUM ('PENDIENTE', 'LISTO', 'RETIRADO');

-- AlterEnum
-- Se simplifican los estados: primero se pasa la columna a texto para poder reasignar libremente,
-- lo que ya estaba cerrado queda FINALIZADO y todo lo demás pasa a EN_CURSO
BEGIN;
ALTER TABLE "servicios_tecnicos" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "servicios_tecnicos" ALTER COLUMN "estado" TYPE TEXT USING ("estado"::text);
UPDATE "servicios_tecnicos" SET "estado" = 'FINALIZADO' WHERE "estado" IN ('ENTREGADO', 'RECHAZADO');
UPDATE "servicios_tecnicos" SET "estado" = 'EN_CURSO' WHERE "estado" IN ('PRESUPUESTADO', 'PENDIENTE', 'EN_REPARACION', 'REPARADO');
DROP TYPE "EstadoServicio";
CREATE TYPE "EstadoServicio" AS ENUM ('EN_CURSO', 'FINALIZADO');
ALTER TABLE "servicios_tecnicos" ALTER COLUMN "estado" TYPE "EstadoServicio" USING ("estado"::"EstadoServicio");
ALTER TABLE "servicios_tecnicos" ALTER COLUMN "estado" SET DEFAULT 'EN_CURSO';
COMMIT;

-- AlterTable
ALTER TABLE "servicios_tecnicos" DROP COLUMN "repuestos_solicitados",
ADD COLUMN     "codigo_retiro" TEXT,
ADD COLUMN     "estado_retiro" "EstadoRetiro",
ADD COLUMN     "fecha_estimada_fin" TIMESTAMP(3),
ADD COLUMN     "tareas" TEXT,
ADD COLUMN     "tipo_comprobante" "TipoComprobante";

-- CreateIndex
CREATE UNIQUE INDEX "servicios_tecnicos_codigo_retiro_key" ON "servicios_tecnicos"("codigo_retiro");
