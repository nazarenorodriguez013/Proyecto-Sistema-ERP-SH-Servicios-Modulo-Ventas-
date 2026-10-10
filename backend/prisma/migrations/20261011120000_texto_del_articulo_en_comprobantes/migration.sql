-- DropForeignKey
ALTER TABLE "detalles_venta" DROP CONSTRAINT "detalles_venta_producto_id_fkey";
ALTER TABLE "servicio_repuestos" DROP CONSTRAINT "servicio_repuestos_producto_id_fkey";

-- AlterTable
ALTER TABLE "detalles_venta" ADD COLUMN "nombre_producto" TEXT NOT NULL DEFAULT '',
ADD COLUMN "codigo_producto" TEXT,
ALTER COLUMN "producto_id" DROP NOT NULL;

ALTER TABLE "servicio_repuestos" ADD COLUMN "nombre_producto" TEXT NOT NULL DEFAULT '',
ADD COLUMN "codigo_producto" TEXT,
ALTER COLUMN "producto_id" DROP NOT NULL;

-- Los comprobantes ya emitidos toman el texto del artículo actual
UPDATE "detalles_venta" d SET "nombre_producto" = p."nombre", "codigo_producto" = p."codigo" FROM "productos" p WHERE p."id" = d."producto_id";
UPDATE "servicio_repuestos" d SET "nombre_producto" = p."nombre", "codigo_producto" = p."codigo" FROM "productos" p WHERE p."id" = d."producto_id";

-- AddForeignKey
ALTER TABLE "detalles_venta" ADD CONSTRAINT "detalles_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "servicio_repuestos" ADD CONSTRAINT "servicio_repuestos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
