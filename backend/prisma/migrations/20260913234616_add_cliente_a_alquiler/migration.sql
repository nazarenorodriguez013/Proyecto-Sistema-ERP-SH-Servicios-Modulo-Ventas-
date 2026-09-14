-- AlterTable
ALTER TABLE "alquileres" DROP COLUMN "cliente",
ADD COLUMN     "cliente_id" INTEGER;

-- AddForeignKey
ALTER TABLE "alquileres" ADD CONSTRAINT "alquileres_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
