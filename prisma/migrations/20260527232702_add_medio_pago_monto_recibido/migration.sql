-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ventas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "total" REAL NOT NULL,
    "medio_pago" TEXT NOT NULL DEFAULT 'Efectivo',
    "monto_recibido" REAL,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ventas" ("creado_en", "id", "total", "usuario_id") SELECT "creado_en", "id", "total", "usuario_id" FROM "ventas";
DROP TABLE "ventas";
ALTER TABLE "new_ventas" RENAME TO "ventas";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "categories_name_key";
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- RedefineIndex
DROP INDEX "products_code_key";
CREATE UNIQUE INDEX "productos_codigo_key" ON "productos"("codigo");

-- RedefineIndex
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");
