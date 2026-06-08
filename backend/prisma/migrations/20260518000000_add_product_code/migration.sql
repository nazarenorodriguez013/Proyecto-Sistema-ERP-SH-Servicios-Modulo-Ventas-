ALTER TABLE "products" ADD COLUMN "code" TEXT;

UPDATE "products" SET "code" = printf('%04d', id);

CREATE UNIQUE INDEX "products_code_key" ON "products"("code");
