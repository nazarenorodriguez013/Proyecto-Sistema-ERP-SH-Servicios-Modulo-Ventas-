-- AlterTable
ALTER TABLE "servicios_tecnicos" ADD COLUMN     "listo_en" TIMESTAMP(3),
ADD COLUMN     "retirado_en" TIMESTAMP(3);

-- Los retiros ya registrados no guardaban la hora: se toma la de finalización del servicio, o la de ingreso si no se finalizó
UPDATE "servicios_tecnicos" SET "retirado_en" = COALESCE("entregado_en", "fecha_ingreso") WHERE "estado_retiro" = 'RETIRADO';
UPDATE "servicios_tecnicos" SET "listo_en" = "retirado_en" WHERE "estado_retiro" = 'RETIRADO';
