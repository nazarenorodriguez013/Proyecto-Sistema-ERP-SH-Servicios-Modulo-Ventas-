# Backend Laravel – SH Servicios

API del ERP en **Laravel 12 + MySQL**, pensada para hosting compartido (Hostinger), donde no se puede ejecutar Node.
Reemplaza al backend Node/Express/PostgreSQL anterior con las mismas rutas y respuestas, así el frontend React no cambia.
Laravel también sirve el frontend compilado: aplicación y API quedan en el mismo dominio.

## Qué cambia respecto del backend Node

| Antes | Ahora | Por qué |
|---|---|---|
| PostgreSQL | MySQL / MariaDB | Es la base que ofrece Hostinger |
| Socket.io (tiempo real) | Las pantallas consultan `GET /api/eventos` cada 5 s | El hosting compartido no permite conexiones permanentes |
| Seed automático con usuarios de prueba al arrancar | `php artisan db:seed` solo en desarrollo; en producción `php artisan erp:crear-admin` | No dejar cuentas con contraseñas conocidas en producción |
| La venta devolvía el usuario completo (con el hash de la contraseña) | Los datos sensibles del usuario nunca salen por la API | Seguridad |
| Limpieza diaria de auditoría con un temporizador | Se hace al iniciar sesión, una vez por día | No hay procesos permanentes |

## Desarrollo local (XAMPP)

```bash
composer install
cp .env.example .env     # completar DB_* (por ejemplo root sin clave) y APP_ENV=local
php artisan key:generate
# JWT_SECRET: cualquier texto largo al azar
php artisan migrate
php artisan db:seed      # usuarios de prueba admin/vendedor/técnico y catálogo de ejemplo
php artisan serve        # API en http://localhost:8000
```

Frontend: `cd ../frontend && npm run dev` (Vite redirige `/api` al puerto 8000).

Pruebas de la API (base nueva y descartable, con `MAILS_LOG` en el `.env` y `APP_ENV=local`):

```bash
php artisan migrate:fresh --seed
API=http://localhost:8000/api MAILS_LOG=/ruta/mails.log node tests/qa-api.js
```

Para probar la concurrencia (ventas simultáneas) conviene correrlas contra Apache: `php artisan serve` atiende de a un pedido.

## Publicar en Hostinger

1. **Compilar el frontend** en la PC: `cd frontend && npm run build:hostinger`. Copia la aplicación React a `backend/public`.
2. **Instalar dependencias de producción**: `cd backend && composer install --no-dev --optimize-autoloader`.
3. **Base de datos**: en hPanel → *Bases de datos MySQL*, crear base y usuario.
4. **Subir** la carpeta `backend` completa (con `vendor/`) por el Administrador de archivos o FTP:
   - Opción recomendada: subirla fuera de `public_html` (por ejemplo `~/erp`) y apuntar el dominio o subdominio a `~/erp/public`.
   - Si solo se puede usar `public_html`: subir el contenido ahí; el `.htaccess` de la raíz redirige todo a `public/`.
5. **Configurar** `.env` a partir de `.env.example` (`APP_ENV=production`, `APP_URL`, datos de la base, `JWT_SECRET`, correo).
6. **Por SSH** (hPanel → Avanzado → SSH), dentro de la carpeta del proyecto:
   ```bash
   php artisan key:generate
   php artisan migrate --force
   php artisan erp:crear-admin "Nombre" correo@empresa.com "Contraseña1"
   php artisan config:cache && php artisan route:cache
   ```
   Si el plan no tiene SSH, se puede correr la migración en local contra la base remota (MySQL remoto habilitado en hPanel).
7. Verificar `https://tu-dominio.com/health` → `{"status":"ok"}`.

PHP 8.2 o superior (se elige en hPanel → PHP), con las extensiones `pdo_mysql`, `mbstring` y `openssl`, que vienen activadas por defecto.

Para actualizar el sistema: repetir 1, 2 y 4 (sin pisar `.env`), y `php artisan migrate --force` si hay migraciones nuevas.

## Traer los datos del sistema anterior (PostgreSQL)

Desde una PC que llegue a las dos bases, con la base MySQL ya migrada y vacía:

```bash
php -d extension=pdo_pgsql artisan erp:migrar-postgres "pgsql:host=HOST;port=5432;dbname=BASE" USUARIO CLAVE
```

Copia todas las tablas conservando ids, contraseñas (bcrypt) y la verificación en dos pasos. Para que Google Authenticator
siga funcionando, `JWT_SECRET` tiene que ser el mismo que en el sistema anterior. Las sesiones abiertas no se trasladan:
cada usuario vuelve a iniciar sesión una vez.
