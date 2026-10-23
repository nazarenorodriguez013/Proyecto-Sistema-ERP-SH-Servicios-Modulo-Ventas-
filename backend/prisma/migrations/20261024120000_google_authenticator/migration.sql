-- Verificación en dos pasos con Google Authenticator: secreto cifrado, secreto en configuración y último código usado
ALTER TABLE "usuarios" ADD COLUMN "totp_secreto" TEXT,
ADD COLUMN "totp_pendiente" TEXT,
ADD COLUMN "totp_ultimo_paso" INTEGER;
