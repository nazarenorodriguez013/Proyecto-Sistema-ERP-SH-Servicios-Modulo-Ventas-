-- AlterTable
ALTER TABLE "categorias" ADD COLUMN "tipo" "TipoProducto" NOT NULL DEFAULT 'REPUESTO';

-- Las categorías que ya tenían solo maquinaria pasan a ser de maquinaria
UPDATE "categorias" c SET "tipo" = 'MAQUINARIA'
WHERE EXISTS (SELECT 1 FROM "productos" p WHERE p."categoria_id" = c."id" AND p."tipo_producto" = 'MAQUINARIA')
  AND NOT EXISTS (SELECT 1 FROM "productos" p WHERE p."categoria_id" = c."id" AND p."tipo_producto" = 'REPUESTO');

-- Las que mezclaban ambos tipos se separan: la maquinaria pasa a una categoría nueva "<nombre> (maquinaria)"
INSERT INTO "categorias" ("nombre", "tipo")
SELECT c."nombre" || ' (maquinaria)', 'MAQUINARIA'
FROM "categorias" c
WHERE c."tipo" = 'REPUESTO'
  AND EXISTS (SELECT 1 FROM "productos" p WHERE p."categoria_id" = c."id" AND p."tipo_producto" = 'MAQUINARIA');

UPDATE "productos" p SET "categoria_id" = n."id"
FROM "categorias" c JOIN "categorias" n ON n."nombre" = c."nombre" || ' (maquinaria)'
WHERE p."categoria_id" = c."id" AND p."tipo_producto" = 'MAQUINARIA' AND c."tipo" = 'REPUESTO';
