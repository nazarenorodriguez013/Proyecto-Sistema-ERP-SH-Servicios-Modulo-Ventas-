-- La confirmación de correo se reemplaza por la verificación en dos pasos opcional
ALTER TABLE "usuarios" DROP COLUMN "correo_confirmado",
DROP COLUMN "confirm_token_hash",
DROP COLUMN "confirm_expira",
ADD COLUMN     "dos_pasos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "codigo_hash" TEXT,
ADD COLUMN     "codigo_expira" TIMESTAMP(3),
ADD COLUMN     "codigo_intentos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "codigo_proposito" TEXT;
