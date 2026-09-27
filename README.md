# Proyecto: Sistema ERP - SH Servicios (Módulo de Ventas)
Sistema de Gestión

Alumnos: Rodriguez Nazareno, Mover Leonardo, Jacobo Santiago.

GRUPO 4.

El presente proyecto consiste en el desarrollo de un sistema ERP especializado en la Gestión de Ventas e Inventario para la empresa SH Servicios. La organización, dedicada a la provisión de insumos y soluciones técnicas, necesita una herramienta digital que centralice sus operaciones comerciales. El sistema busca reemplazar los procesos manuales por una plataforma automatizada que garantice el control total sobre el flujo de mercadería y la transparencia financiera.

## 2. Objetivos del Proyecto

El objetivo principal es implementar una solución Full-Stack que resuelva la desincronización del inventario. El sistema permitirá:

- Digitalizar el catálogo de productos y el proceso de facturación.
- Automatizar la reducción de existencias ante cada venta realizada.
- Garantizar la integridad de los datos mediante una arquitectura robusta y segura.

## 3. Alcance Funcional

El sistema se centra en dos pilares críticos para el funcionamiento de SH Servicios:

**Gestión de Inventario (ABM):** Un módulo completo para el control de artículos. Permite el alta, baja, modificación y consulta de productos, categorías y niveles de stock mínimo.

**Venta Transaccional y Facturación:** Interfaz para procesar ventas que vincula múltiples productos, calcula totales de forma automática y genera el registro de la operación.

**Control de Stock en Tiempo Real:** Validación de disponibilidad antes de confirmar la venta y descuento automático de unidades en la base de datos al completar la transacción.

**Clientes y Cuenta Corriente:** ABM de clientes con su historial de compras. Una venta puede asociarse a un cliente y, si se cobra a cuenta corriente, la deuda queda registrada en su cuenta, donde se cargan los pagos y se consulta el saldo. El cliente puede dejar un anticipo o pagar de más: queda como **saldo a favor** y se descuenta de sus próximas compras o servicios a cuenta corriente.

**Servicio Técnico:** Registro de solicitudes de reparación o mantenimiento. Sin garantía se genera un presupuesto de mano de obra que el cliente acepta o rechaza; con garantía pasa directo al taller sin costo. Administración asigna un técnico, el técnico carga los repuestos que salen del depósito (se descuentan del stock en ese momento) y marca la reparación como terminada. Al entregar el equipo se registra el cobro, la fecha del próximo mantenimiento y se emite el recibo.

**Seguridad y Acceso:** Sistema de autenticación con JWT y tres roles: **Administrador** (acceso total), **Vendedor** (ventas, consulta de inventario, alta y edición de clientes, cobros y atención de servicios técnicos) y **Técnico** (solo ve los servicios que tiene asignados, carga repuestos y cierra reparaciones).

### Navegación

El menú tiene un solo nivel y cada rol ve solo lo que usa:

| Pantalla | Roles | Qué se hace |
|---|---|---|
| Punto de Venta | Administrador, Vendedor | Buscar productos (Enter agrega una unidad), elegir o crear el cliente en el momento, cobrar e imprimir el comprobante |
| Servicios Técnicos | Todos | Arranca mostrando lo que está en curso; el técnico ve directamente sus reparaciones. El administrador tiene además la pestaña **Técnicos** para darlos de alta, editarlos o eliminarlos |
| Clientes | Administrador, Vendedor | Buscar, crear y abrir la ficha con compras, cuenta corriente y pagos; el saldo se muestra como "Debe", "A favor" o "Al día" |
| Inventario | Administrador, Vendedor | Artículos con filtros de stock (bajo, sin stock, inactivos) y ajuste rápido; categorías en una pestaña. El menú muestra cuántos productos hay para reponer |

## 4. Tecnologías Utilizadas

Para cumplir con los requisitos de alta disponibilidad y solidez técnica, se utilizó el siguiente stack:

- **Backend:** Node.js con Express y TypeScript (arquitectura en capas: Controladores, Servicios, Rutas).
- **Base de Datos:** PostgreSQL gestionado a través de Prisma ORM para asegurar un tipado estricto de los modelos de datos.
- **Frontend:** React con TypeScript, orientado a una experiencia de usuario ágil y responsiva.
- **Comunicación en Tiempo Real:** Uso de WebSockets con Socket.io para notificar instantáneamente la actualización de stock en todos los terminales cuando se realiza una venta.

## 5. Diagrama Entidad-Relación (DER)

![Diagrama Entidad-Relación](diagrama_Prog3_sh.png)

## 6. Estructura de la Base de Datos

El sistema se apoya en una estructura relacional de 9 tablas:

- **usuarios:** Gestión de credenciales y perfiles de acceso de los empleados.
- **categorias:** Clasificación organizada de los productos de SH Servicios.
- **productos:** Registro maestro de artículos (precios, descripción, código único y stock).
- **ventas:** Registro de cabecera de cada venta (fecha, total, medio de pago, usuario que la realizó y cliente opcional).
- **detalles_venta:** Detalle de los artículos y cantidades incluidas en cada venta.
- **clientes:** Datos de los clientes (nombre, documento único, teléfono, email y dirección).
- **movimientos_cuenta:** Cuenta corriente de cada cliente: las ventas y servicios a cuenta suman deuda y los pagos la restan.
- **servicios_tecnicos:** Solicitudes de reparación (cliente, equipo, falla, repuestos necesarios, garantía, mano de obra, técnico asignado, estado, cobro y próximo mantenimiento).
- **servicio_repuestos:** Repuestos del inventario utilizados en cada servicio, con cantidad y precio.

## 7. Despliegue en la Nube

- **Infraestructura:** Railway.
- **Persistencia:** PostgreSQL.
- **URL en producción:** https://shservicios.up.railway.app
- **Video demostrativo:** https://docs.google.com/videos/d/1ngwUMvq3eBCNWe08Jg4TMqS4w7DkrUHbVXDghk6yFb4/edit?usp=sharing

## Conclusión

Este sistema proporciona a SH Servicios una herramienta técnica avanzada para el control de su activo más importante: el stock. La integración de WebSockets y la arquitectura en TypeScript aseguran una plataforma escalable, rápida y libre de errores de sincronización, cumpliendo con los estándares actuales de desarrollo de software.

---

## Contribuciones Individuales (Plus de Promoción)

### Rodriguez Nazareno
Desarrolló el módulo de **Ventas**: registro de comprobantes con múltiples productos, cálculo automático de totales, validación de stock antes de confirmar y descuento automático de unidades al completar la transacción.

**Plus individual — Comprobantes, documentos fiscales y configuración de empresa:**

- **Listado de comprobantes** (`frontend/src/pages/Comprobantes.tsx`): historial completo de ventas con modal de detalle y reimpresión. Consume `GET /sales` que trae ventas con sus ítems (tabla `detalles_venta`) via `backend/src/services/sale.service.ts`.
- **Selector Factura / Remito en Punto de Venta** (`frontend/src/utils/print.ts`): antes de confirmar la venta el usuario elige el tipo de comprobante. La **Factura** genera un documento A4 con formato ARCA/AFIP (CUIT, razón social, IVA 21%, CAE, totales). El **Remito** genera un A5 simplificado sin datos fiscales. El tipo queda persistido en la base de datos (campo `tipo_comprobante` en la tabla `ventas`, agregado via `backend/prisma/migrations/`) para poder reimprimir correctamente desde Comprobantes.
- **Configuración de empresa** (`Configuracion.tsx`): pantalla exclusiva para ADMIN donde se cargan los datos que aparecen en las facturas (razón social, CUIT, condición IVA, domicilio, punto de venta, letra de factura, etc.). Los datos se persisten en `localStorage` bajo la clave `sh_config` y los lee `print.ts` al generar cada documento.

---

### Mover Leonardo
Desarrolló los módulos de **Inventario y Artículos**: ABM completo de productos y categorías, control de stock mínimo y visualización del inventario desde el frontend.

> _(plus individual — completar)_

---

### Jacobo Santiago
Desarrolló el sistema de **Login y autenticación JWT**: registro de usuarios, inicio de sesión con contraseñas encriptadas (Bcrypt), generación y validación de tokens JWT, y protección de rutas por rol (ADMIN / VENDEDOR).

Plus individual — Temas visuales, mensajería en tiempo real y alertas de stock:

Sistema de Temas Claro/Oscuro (frontend/src/mejoras_individuales/02_dark_mode/ThemeContext.tsx): implementación de un sistema global de temas mediante React Context y variables CSS. Permite alternar entre modo oscuro y claro desde Configuración, aplicando los cambios en toda la interfaz y persistiendo la preferencia en localStorage.
Tablón de Avisos con Imágenes (frontend/src/pages/Avisos.tsx): desarrollo de una nueva sección de noticias internas accesible desde el sidebar. Permite visualizar publicaciones con título, contenido, imagen, autor y rol. Los administradores pueden crear, editar y eliminar avisos mediante una interfaz dedicada, mientras que el resto de los usuarios dispone de acceso de solo lectura.
Alertas
Alertas de Stock Bajo en Tiempo Real (frontend/src/components/AlertBell.tsx): implementación de alertas automáticas cuando un producto alcanza o supera su stock mínimo. Las notificaciones se envían mediante Socket.io, se visualizan desde una campana de alertas exclusiva para administradores y permiten navegar directamente al producto afectado dentro del módulo de Stock.
---

## Guía de instalación y ejecución local

### Requisitos previos

- [Node.js](https://nodejs.org/) v20 o superior
- npm v9 o superior
- [PostgreSQL](https://www.postgresql.org/) v14 o superior, con una base creada para el proyecto (por ejemplo `sh_servicios`)

### 1. Clonar el repositorio

```bash
git clone https://github.com/nazarenorodriguez013/Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-
cd Proyecto-Sistema-ERP-SH-Servicios-Modulo-Ventas-
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
cd ..
```

### 3. Instalar dependencias del frontend

```bash
cd frontend
npm install
cd ..
```

### 4. Configurar variables de entorno

```bash
cd backend
cp .env.example .env
```

Editar `backend/.env` con los datos de la base PostgreSQL local:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL, por ejemplo `postgresql://postgres:postgres@localhost:5432/sh_servicios` |
| `JWT_SECRET` | Clave con la que se firman los tokens JWT |

Crear las tablas aplicando las migraciones:

```bash
npm run db:migrate
```

Al levantar el backend por primera vez, si la base está vacía se cargan automáticamente los usuarios de prueba, 3 categorías y 9 productos.

### 5. Correr el proyecto

Abrir **dos terminales** en la carpeta raíz del proyecto.

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
El servidor se levanta en `http://localhost:3000`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
El frontend se levanta en `http://localhost:5173`

Abrir el navegador en **http://localhost:5173**

### Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@shservicios.com | admin123 |
| Vendedor | vendedor@shservicios.com | vendedor123 |
| Técnico | tecnico@shservicios.com | tecnico123 |

Si faltan, estos usuarios se crean al levantar el backend, aunque la base ya tenga datos.

### Base de datos

Para borrar todos los datos, recrear las tablas y volver a cargar los datos de prueba:
```bash
cd backend
npm run db:reset
```

Para cargar solo los datos de prueba en una base vacía:
```bash
cd backend
npm run db:seed
```

Para abrir la interfaz visual de la base de datos:
```bash
cd backend
npm run db:studio
```

---

## API — Listado de Endpoints

Base URL en producción: `https://shservicios.up.railway.app`  
Base URL en desarrollo: `http://localhost:3000`

Las rutas marcadas con 🔒 requieren el header `Authorization: Bearer <token>`.  
Las rutas marcadas con 👑 requieren además rol **ADMIN**.  
Las rutas marcadas con 🧾 son para **ADMIN** y **VENDEDOR**; las marcadas con 🛠, para **ADMIN** y **TECNICO**.

### Autenticación — `/api/auth`

| Método | URL completa | Descripción |
|--------|-------------|-------------|
| POST | `https://shservicios.up.railway.app/api/auth/register` | Crea un nuevo usuario |
| POST | `https://shservicios.up.railway.app/api/auth/login` | Inicia sesión y devuelve el token JWT |

### Categorías — `/api/categories`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/categories` | 🔒 | Lista todas las categorías |
| POST | `https://shservicios.up.railway.app/api/categories` | 🔒 👑 | Crea una nueva categoría |
| PUT | `https://shservicios.up.railway.app/api/categories/:id` | 🔒 👑 | Edita el nombre de una categoría |
| DELETE | `https://shservicios.up.railway.app/api/categories/:id` | 🔒 👑 | Elimina una categoría (falla si tiene productos asignados) |

### Productos — `/api/products`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/products` | 🔒 | Lista todos los productos con su categoría |
| GET | `https://shservicios.up.railway.app/api/products/low-stock` | 🔒 | Lista productos activos con stock ≤ stock mínimo |
| GET | `https://shservicios.up.railway.app/api/products/:id` | 🔒 | Obtiene un producto por ID |
| POST | `https://shservicios.up.railway.app/api/products` | 🔒 👑 | Crea un producto (código se genera automáticamente) |
| PUT | `https://shservicios.up.railway.app/api/products/:id` | 🔒 👑 | Edita un producto |
| DELETE | `https://shservicios.up.railway.app/api/products/:id` | 🔒 👑 | Elimina un producto (falla si tiene ventas o servicios registrados; en ese caso se desactiva) |

### Ventas — `/api/sales`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/sales` | 🔒 🧾 | Lista todas las ventas con sus detalles |
| POST | `https://shservicios.up.railway.app/api/sales` | 🔒 🧾 | Registra una venta y descuenta el stock |

Cuerpo de `POST /api/sales`:

```json
{
  "items": [{ "productoId": 4, "cantidad": 2 }],
  "medioPago": "Efectivo",
  "montoRecibido": 120000,
  "clienteId": 1
}
```

El precio unitario y el total se calculan en el servidor con los precios de la base. La venta se rechaza completa si algún producto está inactivo o no tiene stock suficiente. `clienteId` es opcional, salvo con `"medioPago": "Cuenta Corriente"`, que exige cliente y registra la deuda en su cuenta.

### Clientes — `/api/clients`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/clients` | 🔒 🧾 | Lista los clientes con su saldo de cuenta corriente |
| GET | `https://shservicios.up.railway.app/api/clients/:id` | 🔒 🧾 | Ficha del cliente: datos, historial de compras con sus productos, movimientos y saldo |
| POST | `https://shservicios.up.railway.app/api/clients` | 🔒 🧾 | Crea un cliente (el documento no se puede repetir) |
| PUT | `https://shservicios.up.railway.app/api/clients/:id` | 🔒 🧾 | Edita un cliente |
| DELETE | `https://shservicios.up.railway.app/api/clients/:id` | 🔒 👑 | Elimina un cliente (falla si tiene compras, pagos o servicios registrados) |
| POST | `https://shservicios.up.railway.app/api/clients/:id/movements` | 🔒 🧾 | Registra un pago o anticipo en la cuenta corriente. Cuerpo: `{ "monto": 10000 }` |

### Servicios Técnicos — `/api/repairs`

El técnico solo puede ver y modificar los servicios que tiene asignados.

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/repairs` | 🔒 | Lista los servicios (el técnico ve solo los suyos) |
| GET | `https://shservicios.up.railway.app/api/repairs/:id` | 🔒 | Obtiene un servicio con cliente, técnico y repuestos |
| POST | `https://shservicios.up.railway.app/api/repairs` | 🔒 🧾 | Registra una solicitud: `{ "clienteId", "equipo", "descripcionFalla", "repuestosSolicitados", "enGarantia", "costoManoObra" }` (`repuestosSolicitados` es texto libre y opcional) |
| PUT | `https://shservicios.up.railway.app/api/repairs/:id/presupuesto` | 🔒 🧾 | Respuesta del cliente al presupuesto: `{ "aceptado": true }` |
| PUT | `https://shservicios.up.railway.app/api/repairs/:id/tecnico` | 🔒 🧾 | Asigna o reasigna el técnico e inicia la reparación: `{ "tecnicoId" }` |
| POST | `https://shservicios.up.railway.app/api/repairs/:id/repuestos` | 🔒 🛠 | Carga un repuesto y lo descuenta del stock: `{ "productoId", "cantidad" }` |
| DELETE | `https://shservicios.up.railway.app/api/repairs/:id/repuestos/:productoId` | 🔒 🛠 | Quita un repuesto y lo devuelve al stock |
| PUT | `https://shservicios.up.railway.app/api/repairs/:id/reparado` | 🔒 🛠 | Marca la reparación como terminada |
| PUT | `https://shservicios.up.railway.app/api/repairs/:id/entregar` | 🔒 🧾 | Entrega y cobro: `{ "medioPago", "proximoMantenimiento" }` |

Estados de un servicio: `PRESUPUESTADO` → `PENDIENTE` (o `RECHAZADO`) → `EN_REPARACION` → `REPARADO` → `ENTREGADO`. Con garantía se registra directamente como `PENDIENTE` y el total es $0. Si se cobra a `Cuenta Corriente`, el total queda como deuda en la cuenta del cliente.

### Técnicos — `/api/technicians`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://shservicios.up.railway.app/api/technicians` | 🔒 🧾 | Lista los técnicos con la cantidad de servicios asignados |
| POST | `https://shservicios.up.railway.app/api/technicians` | 🔒 👑 | Crea un técnico: `{ "nombre", "correo", "contrasena" }` (mínimo 6 caracteres) |
| PUT | `https://shservicios.up.railway.app/api/technicians/:id` | 🔒 👑 | Edita un técnico; si `contrasena` viene vacía se mantiene la actual |
| DELETE | `https://shservicios.up.railway.app/api/technicians/:id` | 🔒 👑 | Elimina un técnico (falla si tiene servicios asignados) |

### Tiempo real — Socket.io

El frontend se conecta con Socket.io a la misma URL del servidor.

| Evento | Cuándo se emite | Uso en el frontend |
|--------|-----------------|--------------------|
| `stock-actualizado` | Después de confirmar una venta, al crear, editar o eliminar un producto y al cargar o quitar repuestos de un servicio | Punto de Venta, Inventario, el contador de stock bajo del menú y el selector de repuestos se actualizan al instante en todas las terminales |
| `servicios-actualizados` | Ante cualquier cambio en un servicio técnico | Administración y taller ven al instante el estado, el técnico asignado y los repuestos |

### Health check

| Método | URL completa | Descripción |
|--------|-------------|-------------|
| GET | `https://shservicios.up.railway.app/health` | Confirma que el servidor está corriendo |
