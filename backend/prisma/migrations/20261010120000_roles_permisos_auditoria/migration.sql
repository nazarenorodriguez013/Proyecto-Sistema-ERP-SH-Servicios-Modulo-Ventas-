-- Roles con permisos (como el panel del catálogo) en lugar del enum Rol + módulos por usuario,
-- datos extra de usuarios (teléfono, puesto, último acceso, bloqueo por intentos) y registro de auditoría.

-- 1) Roles y sus permisos
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "es_sistema" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_nombre_key" ON "roles"("nombre");
CREATE UNIQUE INDEX "roles_slug_key" ON "roles"("slug");

CREATE TABLE "rol_permisos" (
    "rol_id" INTEGER NOT NULL,
    "permiso" TEXT NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso")
);
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Los cuatro roles de siempre pasan a ser roles de sistema con exactamente lo que podían hacer antes
INSERT INTO "roles" ("nombre", "slug", "descripcion", "es_sistema") VALUES
  ('Administrador', 'admin',      'Acceso total al sistema',                                                  true),
  ('Vendedor',      'vendedor',   'Punto de venta, clientes, cobros y circuito de servicio técnico',          true),
  ('Técnico',       'tecnico',    'Ve sus servicios asignados, carga repuestos y los finaliza',               true),
  ('Inventario',    'inventario', 'Depósito: maquinaria, repuestos, categorías, stock y retiros de repuestos', true);

INSERT INTO "rol_permisos" ("rol_id", "permiso")
SELECT r."id", p.permiso FROM "roles" r
JOIN (VALUES
  ('vendedor', 'productos.ver'), ('vendedor', 'productos.costos'), ('vendedor', 'ventas.crear'), ('vendedor', 'ventas.ver'),
  ('vendedor', 'clientes.gestionar'), ('vendedor', 'servicios.gestionar'), ('vendedor', 'tecnicos.ver'),
  ('vendedor', 'retiros.gestionar'), ('vendedor', 'datos.exportar'),
  ('tecnico', 'servicios.tecnico'), ('tecnico', 'servicios.repuestos'),
  ('inventario', 'productos.ver'), ('inventario', 'productos.editar'), ('inventario', 'productos.costos'),
  ('inventario', 'categorias.gestionar'), ('inventario', 'retiros.gestionar'), ('inventario', 'datos.importar'),
  ('inventario', 'datos.exportar')
) AS p(slug, permiso) ON p.slug = r."slug";

-- 2) Cada usuario queda con el rol equivalente al que tenía
ALTER TABLE "usuarios" ADD COLUMN "rol_id" INTEGER;
UPDATE "usuarios" u SET "rol_id" = r."id" FROM "roles" r WHERE r."slug" = lower(u."rol"::text);
ALTER TABLE "usuarios" ALTER COLUMN "rol_id" SET NOT NULL;
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "usuarios" DROP COLUMN "modulos",
DROP COLUMN "rol",
ADD COLUMN "telefono" TEXT,
ADD COLUMN "puesto" TEXT,
ADD COLUMN "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ultimo_acceso" TIMESTAMP(3),
ADD COLUMN "ultima_ip" TEXT,
ADD COLUMN "intentos_fallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bloqueos_seguidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bloqueado_hasta" TIMESTAMP(3);

DROP TYPE "Rol";

-- 3) Registro de auditoría
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "usuario_nombre" TEXT,
    "accion" TEXT NOT NULL,
    "seccion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidad_id" INTEGER,
    "descripcion" TEXT NOT NULL,
    "datos" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auditoria_creado_en_idx" ON "auditoria"("creado_en");
