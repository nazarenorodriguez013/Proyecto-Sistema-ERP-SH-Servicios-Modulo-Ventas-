-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "modulos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reset_token_hash" TEXT,
ADD COLUMN     "reset_expira" TIMESTAMP(3);

-- Los usuarios que ya existen conservan lo que ven hoy según su rol
UPDATE "usuarios" SET "modulos" = ARRAY['punto-venta','historial-ventas','servicios','tecnicos','historial-servicios','clientes','inventario']::TEXT[] WHERE "rol" IN ('ADMIN', 'VENDEDOR');
UPDATE "usuarios" SET "modulos" = ARRAY['servicios']::TEXT[] WHERE "rol" = 'TECNICO';

-- CreateTable
CREATE TABLE "empresa" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "razon_social" TEXT NOT NULL DEFAULT '',
    "rubro" TEXT NOT NULL DEFAULT '',
    "domicilio" TEXT NOT NULL DEFAULT '',
    "condicion_iva" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "cuit" TEXT NOT NULL DEFAULT '',
    "ingresos_brutos" TEXT NOT NULL DEFAULT '',
    "inicio_actividades" TEXT NOT NULL DEFAULT '',
    "punto_venta" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

INSERT INTO "empresa" ("id", "razon_social", "rubro") VALUES (1, 'SH Servicios', 'Insumos y Soluciones Técnicas');
