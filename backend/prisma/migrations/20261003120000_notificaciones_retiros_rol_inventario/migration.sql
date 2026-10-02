-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'INVENTARIO';

-- CreateEnum
CREATE TYPE "AreaNotificacion" AS ENUM ('INVENTARIO', 'SERVICIOS');

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "notif_vistas_hasta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: hasta ahora el stock se descontaba al cargar el repuesto, así que lo que ya existe cuenta como retirado
ALTER TABLE "servicio_repuestos" ADD COLUMN     "cantidad_retirada" INTEGER NOT NULL DEFAULT 0;
UPDATE "servicio_repuestos" SET "cantidad_retirada" = "cantidad";

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" SERIAL NOT NULL,
    "area" "AreaNotificacion" NOT NULL,
    "usuario_id" INTEGER,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "servicio_id" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificaciones_area_creado_en_idx" ON "notificaciones"("area", "creado_en");
