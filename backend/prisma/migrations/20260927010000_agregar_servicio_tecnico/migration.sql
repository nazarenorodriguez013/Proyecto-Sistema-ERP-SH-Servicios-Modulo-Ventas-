-- CreateEnum
CREATE TYPE "EstadoServicio" AS ENUM ('PRESUPUESTADO', 'PENDIENTE', 'RECHAZADO', 'EN_REPARACION', 'REPARADO', 'ENTREGADO');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'TECNICO';

-- AlterEnum
ALTER TYPE "TipoMovimiento" ADD VALUE 'SERVICIO';

-- AlterTable
ALTER TABLE "movimientos_cuenta" ADD COLUMN     "servicio_id" INTEGER;

-- CreateTable
CREATE TABLE "servicios_tecnicos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "tecnico_id" INTEGER,
    "equipo" TEXT NOT NULL,
    "descripcion_falla" TEXT NOT NULL,
    "en_garantia" BOOLEAN NOT NULL DEFAULT false,
    "costo_mano_obra" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoServicio" NOT NULL,
    "medio_pago" TEXT,
    "total" DOUBLE PRECISION,
    "proximo_mantenimiento" TIMESTAMP(3),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregado_en" TIMESTAMP(3),

    CONSTRAINT "servicios_tecnicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio_repuestos" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "servicio_repuestos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "servicio_repuestos_servicio_id_producto_id_key" ON "servicio_repuestos"("servicio_id", "producto_id");

-- AddForeignKey
ALTER TABLE "movimientos_cuenta" ADD CONSTRAINT "movimientos_cuenta_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios_tecnicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_tecnicos" ADD CONSTRAINT "servicios_tecnicos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_tecnicos" ADD CONSTRAINT "servicios_tecnicos_tecnico_id_fkey" FOREIGN KEY ("tecnico_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_repuestos" ADD CONSTRAINT "servicio_repuestos_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios_tecnicos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio_repuestos" ADD CONSTRAINT "servicio_repuestos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

