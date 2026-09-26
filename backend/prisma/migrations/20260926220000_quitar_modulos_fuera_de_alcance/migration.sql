-- DropForeignKey
ALTER TABLE "ventas" DROP CONSTRAINT "ventas_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "movimientos_cuenta" DROP CONSTRAINT "movimientos_cuenta_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "movimientos_cuenta" DROP CONSTRAINT "movimientos_cuenta_venta_id_fkey";

-- DropForeignKey
ALTER TABLE "alquileres" DROP CONSTRAINT "alquileres_maquina_id_fkey";

-- DropForeignKey
ALTER TABLE "alquileres" DROP CONSTRAINT "alquileres_cliente_id_fkey";

-- DropForeignKey
ALTER TABLE "alquileres" DROP CONSTRAINT "alquileres_usuario_id_fkey";

-- AlterTable
ALTER TABLE "ventas" DROP COLUMN "cliente_id";

-- DropTable
DROP TABLE "clientes";

-- DropTable
DROP TABLE "movimientos_cuenta";

-- DropTable
DROP TABLE "maquinas";

-- DropTable
DROP TABLE "alquileres";

-- DropEnum
DROP TYPE "TipoMovimiento";

-- DropEnum
DROP TYPE "EstadoAlquiler";

