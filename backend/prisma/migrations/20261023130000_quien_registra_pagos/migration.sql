-- Quién cargó cada pago a mano en la cuenta corriente
ALTER TABLE "movimientos_cuenta" ADD COLUMN "registrado_por_id" INTEGER,
ADD COLUMN "registrado_por_nombre" TEXT;
