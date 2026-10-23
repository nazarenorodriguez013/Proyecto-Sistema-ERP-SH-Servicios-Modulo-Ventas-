-- Los pagos eliminados quedan guardados (baja lógica) con quién, cuándo y por qué se eliminaron
ALTER TABLE "movimientos_cuenta" ADD COLUMN "eliminado_en" TIMESTAMP(3),
ADD COLUMN "eliminado_por_id" INTEGER,
ADD COLUMN "eliminado_por_nombre" TEXT,
ADD COLUMN "motivo_eliminacion" TEXT;

-- CreateIndex
CREATE INDEX "movimientos_cuenta_cliente_id_eliminado_en_idx" ON "movimientos_cuenta"("cliente_id", "eliminado_en");
