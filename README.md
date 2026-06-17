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

**Seguridad y Acceso:** Sistema de autenticación con JWT y roles de usuario, asegurando que solo el personal autorizado pueda modificar el inventario o visualizar el registro de ventas.

## 4. Tecnologías Utilizadas

Para cumplir con los requisitos de alta disponibilidad y solidez técnica, se utilizó el siguiente stack:

- **Backend:** Node.js con Express y TypeScript (arquitectura en capas: Controladores, Servicios, Rutas).
- **Base de Datos:** SQLite gestionado a través de Prisma ORM para asegurar un tipado estricto de los modelos de datos.
- **Frontend:** React con TypeScript, orientado a una experiencia de usuario ágil y responsiva.
- **Comunicación en Tiempo Real:** Uso de WebSockets con Socket.io para notificar instantáneamente la actualización de stock en todos los terminales cuando se realiza una venta.

## 5. Diagrama Entidad-Relación (DER)

![Diagrama Entidad-Relación](diagrama_Prog3_sh.png)

## 6. Estructura de la Base de Datos

El sistema se apoya en una estructura relacional de 5 tablas principales:

- **usuarios:** Gestión de credenciales y perfiles de acceso de los empleados.
- **categorias:** Clasificación organizada de los productos de SH Servicios.
- **productos:** Registro maestro de artículos (precios, descripción, código único y stock).
- **ventas:** Registro de cabecera de cada venta (fecha, total y usuario que la realizó).
- **detalles_venta:** Detalle de los artículos y cantidades incluidas en cada venta.

## 7. Despliegue en la Nube

- **Infraestructura:** Railway.
- **Persistencia:** SQLite.
- **URL en producción:** https://sh-servicios-erp-production.up.railway.app
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
Mensajería Interna en Tiempo Real (frontend/src/components/MessagePanel.tsx): desarrollo de un sistema completo de mensajes privados entre usuarios. Incluye conversaciones, conteo de mensajes no leídos, notificaciones instantáneas mediante Socket.io y actualización en tiempo real sin necesidad de recargar la aplicación.
Alertas de Stock Bajo en Tiempo Real (frontend/src/components/AlertBell.tsx): implementación de alertas automáticas cuando un producto alcanza o supera su stock mínimo. Las notificaciones se envían mediante Socket.io, se visualizan desde una campana de alertas exclusiva para administradores y permiten navegar directamente al producto afectado dentro del módulo de Stock.
---

## Guía de instalación y ejecución local

### Requisitos previos

- [Node.js](https://nodejs.org/) v20 o superior
- npm v9 o superior

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
cp .env.example .env
```

El `.env` ya viene configurado para usar la base de datos local (`prisma/dev.db`).

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

### Base de datos

La base de datos SQLite ya viene incluida en el repositorio (`backend/prisma/dev.db`) con datos de prueba listos para usar.

Si se necesita resetear o re-sembrar los datos:
```bash
cd backend
npm run db:migrate
npm run db:seed
```

Para abrir la interfaz visual de la base de datos:
```bash
cd backend
npm run db:studio
```

---

## API — Listado de Endpoints

Base URL en producción: `https://sh-servicios-erp-production.up.railway.app`  
Base URL en desarrollo: `http://localhost:3000`

Las rutas marcadas con 🔒 requieren el header `Authorization: Bearer <token>`.  
Las rutas marcadas con 👑 requieren además rol **ADMIN**.

### Autenticación — `/api/auth`

| Método | URL completa | Descripción |
|--------|-------------|-------------|
| POST | `https://sh-servicios-erp-production.up.railway.app/api/auth/register` | Crea un nuevo usuario |
| POST | `https://sh-servicios-erp-production.up.railway.app/api/auth/login` | Inicia sesión y devuelve el token JWT |

### Categorías — `/api/categories`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://sh-servicios-erp-production.up.railway.app/api/categories` | 🔒 | Lista todas las categorías |
| POST | `https://sh-servicios-erp-production.up.railway.app/api/categories` | 🔒 👑 | Crea una nueva categoría |
| PUT | `https://sh-servicios-erp-production.up.railway.app/api/categories/:id` | 🔒 👑 | Edita el nombre de una categoría |
| DELETE | `https://sh-servicios-erp-production.up.railway.app/api/categories/:id` | 🔒 👑 | Elimina una categoría (falla si tiene productos asignados) |

### Productos — `/api/products`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://sh-servicios-erp-production.up.railway.app/api/products` | 🔒 | Lista todos los productos con su categoría |
| GET | `https://sh-servicios-erp-production.up.railway.app/api/products/low-stock` | 🔒 | Lista productos activos con stock ≤ stock mínimo |
| GET | `https://sh-servicios-erp-production.up.railway.app/api/products/:id` | 🔒 | Obtiene un producto por ID |
| POST | `https://sh-servicios-erp-production.up.railway.app/api/products` | 🔒 👑 | Crea un producto (código se genera automáticamente) |
| PUT | `https://sh-servicios-erp-production.up.railway.app/api/products/:id` | 🔒 👑 | Edita un producto |
| DELETE | `https://sh-servicios-erp-production.up.railway.app/api/products/:id` | 🔒 👑 | Elimina un producto |

### Ventas — `/api/sales`

| Método | URL completa | Auth | Descripción |
|--------|-------------|------|-------------|
| GET | `https://sh-servicios-erp-production.up.railway.app/api/sales` | 🔒 | Lista todas las ventas con sus detalles |
| POST | `https://sh-servicios-erp-production.up.railway.app/api/sales` | 🔒 | Registra una venta y descuenta el stock |

### Health check

| Método | URL completa | Descripción |
|--------|-------------|-------------|
| GET | `https://sh-servicios-erp-production.up.railway.app/health` | Confirma que el servidor está corriendo |
