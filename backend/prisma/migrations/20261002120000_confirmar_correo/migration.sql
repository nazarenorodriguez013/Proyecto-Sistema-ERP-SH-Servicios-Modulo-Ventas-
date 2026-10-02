-- AlterTable: los usuarios que ya existen quedan confirmados; los nuevos nacen sin confirmar desde el código
ALTER TABLE "usuarios" ADD COLUMN     "correo_confirmado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "confirm_token_hash" TEXT,
ADD COLUMN     "confirm_expira" TIMESTAMP(3);
