# Sistema ERP – SH Servicios

Sistema de gestión web para **SH Servicios**, empresa dedicada a la provisión de insumos y soluciones técnicas. Centraliza el inventario, las ventas, los clientes con su cuenta corriente y el servicio técnico, y mantiene el stock sincronizado en tiempo real entre todas las terminales.

**Grupo 4** – Rodriguez Nazareno, Mover Leonardo, Jacobo Santiago.

- **Producción:** https://shservicios.up.railway.app
- **Video demostrativo:** [ver video](https://docs.google.com/videos/d/1ngwUMvq3eBCNWe08Jg4TMqS4w7DkrUHbVXDghk6yFb4/edit?usp=sharing)

## Objetivo

Reemplazar los procesos manuales por una plataforma Full-Stack que elimine la desincronización del inventario, digitalice la venta y su comprobante, y dé trazabilidad a las deudas de los clientes y a las reparaciones.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inventario** | ABM de productos y categorías, código autogenerado, stock mínimo, baja lógica. Lista con filtros *Activos*, *Para reponer* e *Inactivos*, orden por stock y exportación a CSV. |
| **Punto de Venta** | Carrito con varios productos (Enter agrega una unidad), cliente opcional, medios de pago, comprobante imprimible. El total se calcula en el servidor; el stock se valida y descuenta de forma atómica. |
| **Clientes y cuenta corriente** | ABM de clientes con historial de compras. Las ventas y servicios a cuenta suman deuda; los pagos y anticipos la restan. Un pago de más queda como **saldo a favor**, que se descuenta automáticamente (casilla "Usar saldo a favor"). El saldo se muestra como *Debe*, *A favor* o *Al día*. Cada pago guarda quién lo cargó; si se elimina (hay que indicar el motivo), deja de figurar en la cuenta y en el saldo pero queda registrado en *Auditoría → Pagos eliminados* con quién lo eliminó, cuándo, el monto y el motivo. |
| **Servicio Técnico** | Solicitud de reparación → presupuesto (sin garantía) → asignación de técnico → carga de repuestos (descuentan stock) → reparación → entrega con cobro, próximo mantenimiento y recibo. |
| **Técnicos** | Alta, edición y baja de técnicos (solo Administrador). |
| **Tiempo real** | Stock y servicios se actualizan en todas las terminales sin recargar (cada pantalla consulta los cambios cada pocos segundos). |

### Roles

| Rol | Alcance |
|---|---|
| **Administrador** | Acceso total, incluida la gestión de productos, categorías, técnicos y baja de clientes. |
| **Vendedor** | Ventas, consulta de inventario, clientes, cobros y circuito de servicio técnico (registrar, presupuestar, asignar, entregar). |
| **Técnico** | Solo ve sus servicios asignados, carga repuestos y marca la reparación como terminada. |

### Verificación en dos pasos

Cada usuario la activa desde **Mi perfil**. Con **Google Authenticator** escanea un código QR (o carga la clave a mano) y confirma con el primer código de la app; desde ahí, al iniciar sesión se pide el código de 6 dígitos que muestra la app. La otra opción es recibir el código por mail. Cinco códigos incorrectos bloquean la cuenta un rato, igual que con la contraseña. Si alguien pierde el celular, el administrador puede apagarla desde *Usuarios* y la persona vuelve a configurarla con un QR nuevo.

### Navegación

| Pantalla | Roles |
|---|---|
| Punto de Venta | Administrador, Vendedor |
| Servicios Técnicos (el Administrador ve además la pestaña *Técnicos*) | Todos |
| Clientes | Administrador, Vendedor |
| Inventario (con contador de productos para reponer) | Administrador, Vendedor |

### Estados del servicio técnico

`PRESUPUESTADO` → `PENDIENTE` (o `RECHAZADO`) → `EN_REPARACION` → `REPARADO` → `ENTREGADO`

Con garantía se registra directamente como `PENDIENTE` y el total es $0. Si se cobra a *Cuenta Corriente*, el total queda como deuda del cliente.

## Tecnologías

| Capa | Stack |
|---|---|
| Backend | PHP 8.2, Laravel 12 (rutas → middlewares → controladores, modelos Eloquent) |
| Base de datos | MySQL / MariaDB con migraciones de Laravel |
| Frontend | React 19, TypeScript, Vite, React Router |
| Seguridad | JWT (8 h) + bcrypt, autorización por rol, verificación en dos pasos opcional con **Google Authenticator** (TOTP, secreto cifrado) o código por mail |
| Tiempo real | Consulta periódica de eventos (`/api/eventos`) |
| Despliegue | Hostinger (hosting compartido) |

## Base de datos

![Diagrama Entidad-Relación](diagrama_Prog3_sh.png)

Nueve tablas: `usuarios`, `categorias`, `productos`, `ventas`, `detalles_venta`, `clientes`, `movimientos_cuenta`, `servicios_tecnicos` y `servicio_repuestos`. El esquema completo está en [`backend/database/migrations`](backend/database/migrations).

## Estructura del proyecto

```
backend/               Laravel
├── app/
│   ├── Http/Controllers/   Auth, Catálogo, Clientes, Ventas, Servicios, Seguridad, Gestión, Importación
│   ├── Http/Middleware/    autenticación, permisos y formato de la API
│   ├── Models/             modelos Eloquent
│   └── Support/            permisos, auditoría, cuenta corriente, TOTP, correo
├── database/          migraciones y datos de prueba
├── routes/api.php     endpoints
├── public/            punto de entrada (y el frontend compilado)
├── tests/qa-api.js    pruebas de la API
└── .env.example
frontend/
└── src/               pages/, components/, config.ts, saldo.ts, servicios.ts, socket.ts, types.ts
```

## Instalación y ejecución local

**Requisitos:** PHP 8.2+ y MySQL (por ejemplo XAMPP), Composer, Node.js 20+ para el frontend.

```bash
git clone https://github.com/nazarenorodriguez013/Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-
cd Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-

cd backend
composer install
cp .env.example .env      # APP_ENV=local, datos de MySQL y JWT_SECRET
php artisan key:generate
php artisan migrate --seed    # crea las tablas y carga usuarios de prueba, 4 categorías y 9 productos
cd ../frontend && npm install
```

En dos terminales:

```bash
cd backend && php artisan serve   # http://localhost:8000
cd frontend && npm run dev        # http://localhost:5173
```

### Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@shservicios.com | admin123 |
| Vendedor | vendedor@shservicios.com | vendedor123 |
| Técnico | tecnico@shservicios.com | tecnico123 |

### Comandos de base de datos (desde `backend/`)

| Comando | Acción |
|---|---|
| `php artisan migrate` | Aplica las migraciones |
| `php artisan migrate:fresh --seed` | Borra todo, recrea las tablas y recarga los datos de prueba |
| `php artisan db:seed` | Carga los datos de prueba |
| `php artisan erp:crear-admin` | Crea un administrador (para producción) |

## API

Base URL: `/api` en el mismo dominio (desarrollo: `http://localhost:8000/api`). Todas las rutas requieren `Authorization: Bearer <token>`, salvo `auth` y `/health`.

Roles: **A** Administrador · **V** Vendedor · **T** Técnico.

### Autenticación – `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/register` | Crea un usuario (rol Vendedor por defecto) |
| POST | `/login` | Devuelve el token JWT y los datos del usuario |

### Categorías – `/api/categories`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | Todos | Lista las categorías |
| POST | `/` | A | Crea una categoría |
| PUT | `/:id` | A | Edita una categoría |
| DELETE | `/:id` | A | Elimina (falla si tiene productos) |

### Productos – `/api/products`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | Todos | Lista los productos con su categoría |
| GET | `/low-stock` | Todos | Productos activos con stock ≤ mínimo |
| GET | `/:id` | Todos | Obtiene un producto |
| POST | `/` | A | Crea un producto (código automático) |
| PUT | `/:id` | A | Edita un producto |
| DELETE | `/:id` | A | Elimina; si tiene ventas o servicios responde 409 y conviene desactivarlo |

### Ventas – `/api/sales`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | A, V | Lista las ventas con sus detalles |
| POST | `/` | A, V | Registra una venta y descuenta el stock |

```json
{
  "items": [{ "productoId": 4, "cantidad": 2 }],
  "medioPago": "Efectivo",
  "montoRecibido": 120000,
  "clienteId": 1,
  "usarSaldo": true
}
```

Precio y total se calculan en el servidor. La venta se rechaza completa si algún producto está inactivo o sin stock suficiente. `clienteId` es opcional, salvo con `"medioPago": "Cuenta Corriente"`. Si el cliente tiene saldo a favor y `usarSaldo` no es `false`, se descuenta y se devuelve en `saldoAplicado`.

### Clientes – `/api/clients`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | A, V | Lista los clientes con su saldo |
| GET | `/:id` | A, V | Ficha: datos, compras, movimientos y saldo |
| POST | `/` | A, V | Crea un cliente (documento único) |
| PUT | `/:id` | A, V | Edita un cliente |
| DELETE | `/:id` | A | Elimina (falla si tiene compras, pagos o servicios) |
| POST | `/:id/movements` | A, V | Registra un pago o anticipo: `{ "monto": 10000 }` |

### Servicios técnicos – `/api/repairs`

El técnico solo ve y modifica los servicios que tiene asignados.

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | Todos | Lista los servicios |
| GET | `/:id` | Todos | Servicio con cliente, técnico y repuestos |
| POST | `/` | A, V | Registra la solicitud: `clienteId`, `equipo`, `descripcionFalla`, `repuestosSolicitados?`, `enGarantia`, `costoManoObra` |
| PUT | `/:id/presupuesto` | A, V | Respuesta del cliente: `{ "aceptado": true }` |
| PUT | `/:id/tecnico` | A, V | Asigna el técnico e inicia la reparación: `{ "tecnicoId" }` |
| POST | `/:id/repuestos` | A, T | Carga un repuesto y descuenta stock: `{ "productoId", "cantidad" }` |
| DELETE | `/:id/repuestos/:productoId` | A, T | Quita un repuesto y lo devuelve al stock |
| PUT | `/:id/reparado` | A, T | Marca la reparación como terminada |
| PUT | `/:id/entregar` | A, V | Entrega y cobro: `{ "medioPago", "proximoMantenimiento", "usarSaldo" }` |

### Técnicos – `/api/technicians`

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/` | A, V | Lista los técnicos con su cantidad de servicios |
| POST | `/` | A | Crea un técnico: `{ "nombre", "correo", "contrasena" }` (mín. 6 caracteres) |
| PUT | `/:id` | A | Edita; con `contrasena` vacía se mantiene la actual |
| DELETE | `/:id` | A | Elimina (falla si tiene servicios asignados) |

### Tiempo real – `GET /api/eventos`

Devuelve un contador por evento (`{ "stock-actualizado": 12, ... }`). Cada pantalla lo consulta cada 5 segundos y, si un contador cambió, recarga sus datos.

| Evento | Sube cuando | Efecto |
|---|---|---|
| `stock-actualizado` | Se confirma una venta, se crea/edita/elimina un producto o se cargan/quitan repuestos | Punto de Venta, Inventario y contador de reposición se actualizan en todas las terminales |
| `servicios-actualizados` | Cambia cualquier servicio técnico | Administración y taller ven el estado al instante |

### Health check

`GET /health` confirma que el servidor está activo.

## Despliegue

Hostinger (hosting compartido con PHP y MySQL). Laravel sirve la API y también el frontend compilado. Pasos completos en [`backend/README.md`](backend/README.md#publicar-en-hostinger).
