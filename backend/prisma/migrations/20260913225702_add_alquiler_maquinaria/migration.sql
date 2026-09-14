-- CreateEnum
CREATE TYPE "EstadoAlquiler" AS ENUM ('ACTIVO', 'FINALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "maquinas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "tipo" TEXT,
    "tarifa_diaria" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maquinas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alquileres" (
    "id" SERIAL NOT NULL,
    "maquina_id" INTEGER NOT NULL,
    "cliente" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoAlquiler" NOT NULL DEFAULT 'ACTIVO',
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alquileres_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maquinas_codigo_key" ON "maquinas"("codigo");

-- AddForeignKey
ALTER TABLE "alquileres" ADD CONSTRAINT "alquileres_maquina_id_fkey" FOREIGN KEY ("maquina_id") REFERENCES "maquinas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alquileres" ADD CONSTRAINT "alquileres_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
