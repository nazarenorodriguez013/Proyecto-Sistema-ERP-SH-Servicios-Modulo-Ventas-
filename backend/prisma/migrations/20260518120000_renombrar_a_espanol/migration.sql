-- Renombrar tablas
ALTER TABLE "users"       RENAME TO "usuarios";
ALTER TABLE "categories"  RENAME TO "categorias";
ALTER TABLE "products"    RENAME TO "productos";
ALTER TABLE "sales"       RENAME TO "ventas";
ALTER TABLE "sale_details" RENAME TO "detalles_venta";

-- Columnas de usuarios (era users)
ALTER TABLE "usuarios" RENAME COLUMN "name"      TO "nombre";
ALTER TABLE "usuarios" RENAME COLUMN "email"     TO "correo";
ALTER TABLE "usuarios" RENAME COLUMN "password"  TO "contrasena";
ALTER TABLE "usuarios" RENAME COLUMN "role"      TO "rol";
ALTER TABLE "usuarios" RENAME COLUMN "createdAt" TO "creado_en";
ALTER TABLE "usuarios" RENAME COLUMN "updatedAt" TO "actualizado_en";

-- Columnas de categorias (era categories)
ALTER TABLE "categorias" RENAME COLUMN "name"      TO "nombre";
ALTER TABLE "categorias" RENAME COLUMN "createdAt" TO "creado_en";

-- Columnas de productos (era products)
ALTER TABLE "productos" RENAME COLUMN "code"        TO "codigo";
ALTER TABLE "productos" RENAME COLUMN "name"        TO "nombre";
ALTER TABLE "productos" RENAME COLUMN "description" TO "descripcion";
ALTER TABLE "productos" RENAME COLUMN "costPrice"   TO "precio_costo";
ALTER TABLE "productos" RENAME COLUMN "price"       TO "precio";
ALTER TABLE "productos" RENAME COLUMN "minStock"    TO "stock_minimo";
ALTER TABLE "productos" RENAME COLUMN "active"      TO "activo";
ALTER TABLE "productos" RENAME COLUMN "categoryId"  TO "categoria_id";
ALTER TABLE "productos" RENAME COLUMN "createdAt"   TO "creado_en";
ALTER TABLE "productos" RENAME COLUMN "updatedAt"   TO "actualizado_en";

-- Columnas de ventas (era sales)
ALTER TABLE "ventas" RENAME COLUMN "userId"    TO "usuario_id";
ALTER TABLE "ventas" RENAME COLUMN "createdAt" TO "creado_en";

-- Columnas de detalles_venta (era sale_details)
ALTER TABLE "detalles_venta" RENAME COLUMN "saleId"    TO "venta_id";
ALTER TABLE "detalles_venta" RENAME COLUMN "productId" TO "producto_id";
ALTER TABLE "detalles_venta" RENAME COLUMN "quantity"  TO "cantidad";
ALTER TABLE "detalles_venta" RENAME COLUMN "unitPrice" TO "precio_unitario";
