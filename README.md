# Sistema ERP – SH Servicios

Sistema de gestión web para **SH Servicios**, empresa de Concordia (Entre Ríos) dedicada a la venta y el servicio técnico de maquinaria y repuestos. Centraliza el catálogo de maquinaria y repuestos, las ventas con su comprobante, los clientes con su cuenta corriente y el servicio técnico, y mantiene el stock sincronizado en tiempo real entre todas las terminales.

**Integrantes:** Rodriguez Nazareno, Mover Leonardo, Jacobo Santiago.

- **Producción:** https://shservicios.up.railway.app
- **Video demostrativo:** [ver video](https://docs.google.com/videos/d/1ngwUMvq3eBCNWe08Jg4TMqS4w7DkrUHbVXDghk6yFb4/edit?usp=sharing)

## Objetivo

Reemplazar los procesos manuales por una plataforma Full-Stack que elimine la desincronización del inventario, digitalice la venta y su comprobante, comunique al taller con el depósito de repuestos y dé trazabilidad a las deudas de los clientes y a las reparaciones.

## Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Inicio** | Indicadores del día (maquinaria, repuestos, servicios en curso, ventas de hoy), pendientes para revisar, últimas ventas y accesos rápidos. |
| **Catálogo** | Maquinaria y repuestos por separado, con categorías por tipo. Código autogenerado, precio de costo y de venta con su ganancia, stock mínimo y baja lógica. Filtros *Activos*, *Para reponer* e *Inactivos*. |
| **Punto de Venta** | Carrito con varios productos (Enter agrega una unidad), cliente opcional, medios de pago (Efectivo, Débito, Crédito, Transferencia, Cuenta Corriente) y comprobante imprimible: **Factura**, **Remito** o **Presupuesto**. El total se calcula en el servidor y el stock se valida y descuenta de forma atómica. El presupuesto solo se imprime: no descuenta stock ni se guarda. Desde acá también se puede pedir un servicio técnico. |
| **Historial de Ventas** | Listado de comprobantes con reimpresión. Anular una venta devuelve el stock y saca la deuda que había generado. |
| **Clientes y cuenta corriente** | ABM de clientes (documento único, condición frente al IVA) con historial de compras y servicios. Las ventas y servicios a cuenta suman deuda; los pagos y anticipos la restan. Un pago de más queda como **saldo a favor**, que se descuenta automáticamente (casilla "Usar saldo a favor"). El saldo se muestra como *Debe*, *A favor* o *Al día*. Cada pago guarda quién lo cargó; si se elimina (hay que indicar el motivo), deja de figurar en la cuenta y en el saldo pero queda en *Auditoría → Pagos eliminados*. |
| **Servicio Técnico** | Alta del servicio (cliente, equipo, falla, tareas, mano de obra estimada, garantía y fecha estimada), presupuesto imprimible, asignación de técnico, carga de repuestos, diagnóstico y trabajo realizado, y cierre con comprobante, cobro y próximo mantenimiento. Historial de servicios finalizados. |
| **Retiro de repuestos** | Los repuestos de un servicio forman un pedido al depósito: `PENDIENTE` → `LISTO` (avisa a Servicios Técnicos) → `RETIRADO` (recién ahí se descuenta el stock). Un servicio no se puede finalizar con repuestos sin retirar. |
| **Técnicos** | Alta, edición y baja de técnicos. |
| **Importar / Exportar** | Importación de maquinaria y repuestos desde CSV con vista previa y errores por fila. Exportación de maquinaria, repuestos, lista de precios, clientes, ventas, servicios y auditoría. |
| **Configuración** | Datos fiscales de la empresa que salen en los comprobantes (razón social, CUIT, condición frente al IVA, ingresos brutos, inicio de actividades, punto de venta). |
| **Usuarios y roles** | Alta, edición, desactivación y baja de usuarios. Roles con permisos configurables por módulo. |
| **Auditoría** | Registro de cada acción: quién, cuándo, desde qué IP, en qué sección y qué cambió (valor anterior y nuevo). Incluye los pagos eliminados. |
| **Notificaciones** | Campana con avisos del circuito de servicio técnico: servicio sin técnico, servicio asignado, repuestos pedidos al depósito, repuestos listos para retirar y servicio finalizado. Cada usuario ve los de su área y los dirigidos a él. |
| **Tiempo real** | Socket.io actualiza stock, servicios, notificaciones y permisos en todas las terminales sin recargar. |

### Roles y permisos

Cada usuario tiene un rol, y cada rol un conjunto de permisos que se edita desde **Roles**. El menú y la API usan esos permisos (la API los vuelve a validar en cada pedido). El sistema trae cuatro roles:

| Rol | Alcance |
|---|---|
| **Administrador** | Acceso total; siempre tiene todos los permisos. |
| **Vendedor** | Punto de venta, historial de ventas, clientes y cobros, circuito de servicio técnico, retiros de repuestos y exportación. |
| **Técnico** | Solo ve sus servicios asignados, carga repuestos y los finaliza. |
| **Inventario** | Depósito: maquinaria, repuestos, categorías, stock, retiros de repuestos, importación y exportación. |

Se pueden crear roles nuevos combinando los permisos de cada módulo: Catálogo, Ventas y clientes, Servicio técnico, Gestión y Seguridad.

### Seguridad

- Contraseñas con bcrypt y sesión con JWT de 8 h.
- Cinco intentos fallidos bloquean la cuenta; si se sigue insistiendo, el bloqueo escala (5 min, 15 min, 1 h y 6 h).
- Recuperación de contraseña por mail.
- Inicio de sesión con Google (opcional), solo para correos que ya tienen usuario creado.
- **Verificación en dos pasos** opcional, que cada usuario activa desde **Mi perfil**: con **Google Authenticator** (escanea un QR y confirma con el primer código) o con un código por mail. Los códigos incorrectos cuentan como contraseñas incorrectas. Si alguien pierde el celular, el administrador puede apagarla desde *Usuarios*.

### Estados del servicio técnico

`EN_CURSO` → `FINALIZADO`

Al finalizar se genera el comprobante (Factura o Remito) y se cobra. Si el equipo está en garantía, no se le cobra al cliente. Si se cobra a *Cuenta Corriente*, el total queda como deuda del cliente. Eliminar un servicio devuelve los repuestos al depósito y saca la deuda que había generado.

## Tecnologías

| Capa | Stack |
|---|---|
| Backend | Node.js 20, Express 5, TypeScript, arquitectura en capas (rutas → controladores → servicios) |
| Base de datos | PostgreSQL con Prisma ORM y migraciones |
| Frontend | React 19, TypeScript, Vite, React Router |
| Seguridad | JWT + bcrypt, permisos por rol, verificación en dos pasos (TOTP o mail), inicio de sesión con Google |
| Tiempo real | Socket.io |
| Mail | Resend o SMTP (Nodemailer) |
| Despliegue | Railway (Nixpacks) |

## Base de datos

![Diagrama Entidad-Relación](diagrama_Prog3_sh.png)

Quince tablas: `usuarios`, `roles`, `rol_permisos`, `auditoria`, `categorias`, `productos`, `correlativos`, `ventas`, `detalles_venta`, `clientes`, `movimientos_cuenta`, `servicios_tecnicos`, `servicio_repuestos`, `empresa` y `notificaciones`. El esquema completo está en [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).

La numeración de los comprobantes (Factura, Remito y Presupuesto) es correlativa por tipo y compartida entre Ventas y Servicios Técnicos.

## Estructura del proyecto

```
backend/
├── prisma/            schema.prisma y migraciones
├── src/
│   ├── controllers/   capa HTTP
│   ├── routes/        endpoints y permisos por ruta
│   ├── services/      reglas de negocio y acceso a datos
│   ├── middlewares/   autenticación y permisos
│   ├── utils/         catálogo de permisos y utilidades
│   ├── socket.ts      instancia de Socket.io
│   ├── seed.ts        datos iniciales
│   └── index.ts
└── .env.example
frontend/
└── src/               pages/, components/, config.ts, permisos.ts, saldo.ts, servicios.ts, socket.ts, types.ts
```

## Instalación y ejecución local

**Requisitos:** Node.js 20+, npm 9+ y PostgreSQL 14+ con una base creada (por ejemplo `sh_servicios`).

```bash
git clone https://github.com/nazarenorodriguez013/Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-
cd Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-

cd backend && npm install && cd ..
cd frontend && npm install && cd ..

cd backend
cp .env.example .env      # completar DATABASE_URL y JWT_SECRET
npm run db:migrate        # crea las tablas
```

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión a PostgreSQL, ej. `postgresql://postgres:postgres@localhost:5432/sh_servicios` |
| `JWT_SECRET` | Sí | Clave con la que se firman los tokens |
| `APP_URL` | No | URL pública del sistema, para los links de los mails |
| `GOOGLE_CLIENT_ID` | No | Client ID de OAuth de Google; sin él no aparece el botón de Google |
| `RESEND_API_KEY`, `MAIL_FROM` | No | Envío de mails con Resend |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | No | Envío de mails por SMTP (si no hay Resend) |

Sin proveedor de mail configurado, los mails no salen y su contenido queda en el log del servidor.

Al iniciar el backend con la base vacía se cargan los usuarios de prueba, 4 categorías y 9 productos.

En dos terminales:

```bash
cd backend && npm run dev     # http://localhost:3000
cd frontend && npm run dev    # http://localhost:5173
```

### Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@shservicios.com | admin123 |
| Vendedor | vendedor@shservicios.com | vendedor123 |
| Técnico | tecnico@shservicios.com | tecnico123 |

### Scripts de base de datos (desde `backend/`)

| Comando | Acción |
|---|---|
| `npm run db:migrate` | Aplica las migraciones |
| `npm run db:reset` | Borra todo, recrea las tablas y recarga los datos de prueba |
| `npm run db:seed` | Carga los datos de prueba en una base vacía |
| `npm run db:studio` | Abre la interfaz visual de Prisma |

## API

Base URL: `https://shservicios.up.railway.app/api` (desarrollo: `http://localhost:3000/api`). Todas las rutas requieren `Authorization: Bearer <token>`, salvo las de inicio de sesión y `/health`. Cada ruta exige el permiso indicado (el Administrador los tiene todos).

### Autenticación – `/api/auth`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/login` | Devuelve el token JWT y los datos del usuario, o un desafío si tiene verificación en dos pasos |
| POST | `/2fa` | Completa el ingreso con el código de la app o del mail |
| POST | `/2fa/reenviar` | Reenvía el código por mail |
| GET | `/config` | Indica si está habilitado el ingreso con Google |
| POST | `/google` | Ingreso con Google |
| POST | `/forgot` | Envía el link para restablecer la contraseña |
| POST | `/reset` | Restablece la contraseña |
| GET | `/me` | Sesión actual con rol y permisos |
| PUT | `/me` | Edita los datos propios (correo y contraseña piden la contraseña actual) |
| POST | `/2fa/activar`, `/2fa/activar/confirmar` | Activa la verificación por mail |
| POST | `/2fa/app`, `/2fa/app/confirmar` | Activa Google Authenticator |
| POST | `/2fa/desactivar` | Desactiva la verificación en dos pasos |

### Catálogo – `/api/categories` y `/api/products`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/categories` | `productos.ver` | Lista las categorías |
| POST, PUT, DELETE | `/categories`, `/categories/:id` | `categorias.gestionar` | ABM de categorías (no se elimina si tiene productos) |
| GET | `/products` | `productos.ver` | Lista los productos con su categoría |
| GET | `/products/low-stock` | `productos.ver` | Productos activos con stock ≤ mínimo |
| GET | `/products/:id` | `productos.ver` | Obtiene un producto |
| POST, PUT, DELETE | `/products`, `/products/:id` | `productos.editar` | ABM de productos (código automático; si tiene ventas o servicios responde 409 y conviene desactivarlo) |

### Ventas – `/api/sales`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `ventas.ver` | Lista las ventas con sus detalles |
| POST | `/` | `ventas.crear` | Registra una venta y descuenta el stock |
| DELETE | `/:id` | `ventas.anular` | Anula la venta: devuelve el stock y saca la deuda |

```json
{
  "items": [{ "productoId": 4, "cantidad": 2 }],
  "tipoComprobante": "FACTURA",
  "medioPago": "Efectivo",
  "montoRecibido": 120000,
  "clienteId": 1,
  "usarSaldo": true
}
```

Precio y total se calculan en el servidor. La venta se rechaza completa si algún producto está inactivo o sin stock suficiente. `clienteId` es opcional, salvo con `"medioPago": "Cuenta Corriente"`. Si el cliente tiene saldo a favor y `usarSaldo` no es `false`, se descuenta y se devuelve en `saldoAplicado`.

### Clientes – `/api/clients`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `clientes.gestionar` | Lista los clientes con su saldo |
| GET | `/:id` | `clientes.gestionar` | Ficha: datos, compras, movimientos y saldo |
| POST | `/` | `clientes.gestionar` | Crea un cliente (documento único) |
| PUT | `/:id` | `clientes.gestionar` | Edita un cliente |
| DELETE | `/:id` | `clientes.eliminar` | Elimina (falla si tiene compras, pagos o servicios) |
| POST | `/:id/movements` | `clientes.gestionar` | Registra un pago o anticipo: `{ "monto": 10000 }` |
| DELETE | `/:id/movements/:movementId` | `clientes.eliminar` | Elimina un pago indicando el motivo |

### Servicios técnicos – `/api/repairs`

Quien no tiene `servicios.gestionar` (el técnico) solo ve y modifica los servicios que tiene asignados.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `servicios.gestionar` o `servicios.tecnico` | Lista los servicios |
| GET | `/:id` | `servicios.gestionar` o `servicios.tecnico` | Servicio con cliente, técnico y repuestos |
| POST | `/` | `servicios.gestionar` | Crea el servicio: `clienteId`, `tecnicoId?`, `equipo`, `descripcionFalla`, `tareas?`, `enGarantia`, `costoManoObra`, `fechaEstimadaFin?`, `repuestos?` |
| POST | `/presupuesto` | `servicios.gestionar` | Calcula el presupuesto para imprimir (no guarda nada) |
| PUT | `/:id` | `servicios.gestionar` o `servicios.tecnico` | Actualiza mano de obra, fecha estimada y notas |
| PUT | `/:id/tecnico` | `servicios.gestionar` | Asigna o reasigna el técnico: `{ "tecnicoId" }` |
| POST | `/:id/repuestos` | `servicios.repuestos` | Agrega un repuesto al pedido del depósito: `{ "productoId", "cantidad" }` |
| DELETE | `/:id/repuestos/:productoId` | `servicios.repuestos` | Quita un repuesto (si ya se había retirado, vuelve al stock) |
| PUT | `/:id/finalizar` | `servicios.gestionar` o `servicios.tecnico` | Cierra y cobra: `{ "tipoComprobante", "medioPago", "costoManoObra?", "diagnostico?", "trabajoRealizado?", "proximoMantenimiento?", "usarSaldo?" }` |
| DELETE | `/:id` | `servicios.eliminar` | Elimina el servicio, devuelve los repuestos y saca la deuda |
| GET | `/retiros` | `retiros.gestionar` | Cola de repuestos para retirar del depósito |
| PUT | `/retiros/:id` | `retiros.gestionar` | Avanza el retiro: `{ "estado": "LISTO" \| "RETIRADO" }` |

### Técnicos – `/api/technicians`

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/` | `tecnicos.ver` | Lista los técnicos con su cantidad de servicios |
| POST | `/` | `tecnicos.gestionar` | Crea un técnico: `{ "nombre", "correo", "contrasena" }` (mín. 6 caracteres) |
| PUT | `/:id` | `tecnicos.gestionar` | Edita; con `contrasena` vacía se mantiene la actual |
| DELETE | `/:id` | `tecnicos.gestionar` | Elimina (falla si tiene servicios asignados) |

### Usuarios, roles y auditoría

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/users` | `usuarios.ver` | Lista los usuarios |
| POST, PUT, DELETE | `/users`, `/users/:id` | `usuarios.gestionar` | ABM de usuarios |
| GET | `/roles` | `roles.gestionar` o `usuarios.ver` | Lista los roles con sus permisos |
| GET | `/roles/permisos` | `roles.gestionar` | Catálogo de permisos por módulo |
| GET, POST, PUT, DELETE | `/roles`, `/roles/:id` | `roles.gestionar` | ABM de roles |
| GET | `/audit` | `auditoria.ver` | Registro de auditoría |
| GET | `/audit/pagos-eliminados` | `auditoria.ver` | Pagos eliminados con quién, cuándo y por qué |

### Empresa, datos y notificaciones

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/company` | Todos | Datos de la empresa |
| PUT | `/company` | `configuracion.gestionar` | Edita los datos de la empresa |
| POST | `/import/preview` | `datos.importar` | Previsualiza un archivo de productos |
| POST | `/import/run` | `datos.importar` | Importa el archivo |
| GET | `/export/:dataset` | `datos.exportar` | Exporta `maquinaria`, `repuestos`, `precios`, `clientes`, `ventas`, `servicios` o `auditoria` |
| GET | `/notifications` | Todos | Notificaciones del usuario |
| PUT | `/notifications/leidas` | Todos | Marca las notificaciones como leídas |

### Tiempo real (Socket.io)

| Evento | Se emite cuando | Efecto |
|---|---|---|
| `stock-actualizado` | Cambia el stock o un producto (venta, ABM, retiro de repuestos) | Punto de Venta, catálogo y contador de reposición se actualizan en todas las terminales |
| `servicios-actualizados` | Cambia cualquier servicio técnico | Administración, taller y depósito ven el estado al instante |
| `notificaciones-actualizadas` | Hay una notificación nueva | Se actualiza la campana |
| `permisos-actualizados` | Cambian los permisos de un rol | El menú del usuario se actualiza sin volver a iniciar sesión |

### Health check

`GET /health` confirma que el servidor está activo.

## Despliegue

Railway compila con Nixpacks (`nixpacks.toml`): genera el cliente Prisma, construye el frontend y compila el backend. Al arrancar aplica las migraciones (`prisma migrate deploy`) y el mismo servidor Express sirve el frontend compilado. Variables necesarias: `DATABASE_URL` y `JWT_SECRET` (las demás son opcionales, ver la tabla de variables).
