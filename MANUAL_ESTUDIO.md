# MANUAL DE ESTUDIO — SH Servicios ERP (Módulo Ventas)
### Alumnos: Rodríguez Nazareno · Jacobo Santiago · Mover Leonardo

---

# PUNTO A — ARQUITECTURA Y BASE DE DATOS

---

## A.1 Backend: Node.js + Express + TypeScript

El backend es un servidor HTTP construido con:
- **Node.js**: entorno de ejecución de JavaScript del lado del servidor
- **Express 5**: framework para manejar rutas y peticiones HTTP
- **TypeScript**: tipado estático sobre JavaScript

### Arquitectura de carpetas

```
src/
├── index.ts                ← Punto de entrada: crea el servidor, registra rutas
├── routes/                 ← CAPA 1: define URLs y métodos HTTP
│   ├── auth.routes.ts
│   ├── category.routes.ts
│   ├── product.routes.ts
│   └── sale.routes.ts
├── controllers/            ← CAPA 2: recibe req/res, delega al servicio
│   ├── auth.controller.ts
│   ├── category.controller.ts
│   ├── product.controller.ts
│   └── sale.controller.ts
├── services/               ← CAPA 3: lógica de negocio + consultas a la DB
│   ├── auth.service.ts
│   ├── category.service.ts
│   ├── product.service.ts
│   └── sale.service.ts
├── middlewares/
│   └── auth.middleware.ts  ← Intercepta requests para verificar el JWT
├── socket.ts               ← Módulo singleton de Socket.io
└── types/
    └── index.ts            ← Tipo personalizado AuthRequest
```

### Flujo de una petición HTTP (de punta a punta)

```
CLIENTE (fetch desde React)
        │
        ▼
src/routes/sale.routes.ts       → define POST /api/sales
        │
        ▼
src/middlewares/auth.middleware  → verifica JWT, agrega req.user
        │
        ▼
src/controllers/sale.controller → lee req.body, llama al servicio
        │
        ▼
src/services/sale.service       → lógica de negocio + consulta Prisma
        │
        ▼
prisma/dev.db (SQLite)          → escritura/lectura en la base de datos
        │
        ▼
res.json(resultado)             → respuesta JSON al cliente
```

### ¿Por qué separar en capas?

- La **ruta** solo sabe qué URL responde y con qué método HTTP
- El **controlador** solo sabe de HTTP (req, res, status codes). No sabe nada de la DB
- El **servicio** tiene la lógica de negocio. No sabe que existe HTTP
- Si mañana cambiamos Express por otro framework, solo cambia el controlador

---

## A.2 Base de Datos: 5 tablas relacionadas

El proyecto tiene **5 tablas** (más de las 4 requeridas):

### Tabla USUARIOS
| Campo | Tipo | Descripción |
|---|---|---|
| id | Int (PK) | Autoincrementable |
| nombre | String | Nombre del usuario |
| correo | String (único) | Email de login |
| contrasena | String | Hash bcrypt |
| rol | Enum | ADMIN o VENDEDOR |
| creadoEn | DateTime | Fecha de creación |
| actualizadoEn | DateTime | Actualización automática |

### Tabla CATEGORIAS
| Campo | Tipo | Descripción |
|---|---|---|
| id | Int (PK) | Autoincrementable |
| nombre | String (único) | Nombre de la categoría |
| creadoEn | DateTime | Fecha de creación |

### Tabla PRODUCTOS
| Campo | Tipo | Descripción |
|---|---|---|
| id | Int (PK) | Autoincrementable |
| codigo | String (único) | Autogenerado: 0001, 0002... |
| nombre | String | Nombre del producto |
| descripcion | String? | Opcional |
| precioCosto | Float | Precio de costo |
| precio | Float | Precio de venta |
| stock | Int | Cantidad disponible |
| stockMinimo | Int | Umbral de alerta |
| activo | Boolean | Baja lógica sin borrar |
| categoriaId | Int (FK) | Referencia a categorias |

### Tabla VENTAS
| Campo | Tipo | Descripción |
|---|---|---|
| id | Int (PK) | Autoincrementable |
| total | Float | Suma total de la venta |
| medioPago | String | Efectivo/Débito/Crédito/Transferencia |
| montoRecibido | Float? | Solo para efectivo |
| usuarioId | Int (FK) | Referencia a usuarios |
| creadoEn | DateTime | Fecha de la venta |

### Tabla DETALLES_VENTA
| Campo | Tipo | Descripción |
|---|---|---|
| id | Int (PK) | Autoincrementable |
| ventaId | Int (FK) | Referencia a ventas |
| productoId | Int (FK) | Referencia a productos |
| cantidad | Int | Unidades vendidas |
| precioUnitario | Float | Precio al momento de la venta |

---

## A.3 DER — Diagrama Entidad-Relación

```
┌──────────────┐         ┌─────────────────┐
│   USUARIOS   │ 1     N │     VENTAS      │
│──────────────│─────────│─────────────────│
│ id (PK)      │         │ id (PK)         │
│ nombre       │         │ total           │
│ correo       │         │ medioPago       │
│ contrasena   │         │ montoRecibido   │
│ rol          │         │ usuarioId (FK)  │
└──────────────┘         │ creadoEn        │
                         └────────┬────────┘
                                  │ 1
                                  │
                                  │ N
                         ┌────────▼────────┐
                         │ DETALLES_VENTA  │
                         │─────────────────│
                         │ id (PK)         │
                         │ ventaId (FK)    │
                         │ productoId (FK) │
                         │ cantidad        │
                         │ precioUnitario  │
                         └────────┬────────┘
                                  │ N
                                  │
                                  │ 1
┌──────────────┐         ┌────────▼────────┐
│  CATEGORIAS  │ 1     N │    PRODUCTOS    │
│──────────────│─────────│─────────────────│
│ id (PK)      │         │ id (PK)         │
│ nombre       │         │ codigo          │
└──────────────┘         │ nombre          │
                         │ precio          │
                         │ stock           │
                         │ stockMinimo     │
                         │ activo          │
                         │ categoriaId(FK) │
                         └─────────────────┘
```

**Relaciones:**
- 1 Usuario tiene N Ventas
- 1 Venta tiene N DetallesVenta
- 1 Producto aparece en N DetallesVenta
- 1 Categoría tiene N Productos

---

## A.4 ORM Prisma — schema.prisma completo

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Rol {
  ADMIN
  VENDEDOR
}

model Usuario {
  id            Int      @id @default(autoincrement())
  nombre        String
  correo        String   @unique
  contrasena    String
  rol           Rol      @default(VENDEDOR)
  creadoEn      DateTime @default(now())  @map("creado_en")
  actualizadoEn DateTime @updatedAt       @map("actualizado_en")
  ventas        Venta[]
  @@map("usuarios")
}

model Categoria {
  id        Int        @id @default(autoincrement())
  nombre    String     @unique
  creadoEn  DateTime   @default(now()) @map("creado_en")
  productos Producto[]
  @@map("categorias")
}

model Producto {
  id            Int            @id @default(autoincrement())
  codigo        String?        @unique
  nombre        String
  descripcion   String?
  precioCosto   Float          @default(0)  @map("precio_costo")
  precio        Float
  stock         Int            @default(0)
  stockMinimo   Int            @default(5)  @map("stock_minimo")
  activo        Boolean        @default(true)
  categoriaId   Int            @map("categoria_id")
  creadoEn      DateTime       @default(now())  @map("creado_en")
  actualizadoEn DateTime       @updatedAt       @map("actualizado_en")
  categoria     Categoria      @relation(fields: [categoriaId], references: [id])
  detallesVenta DetalleVenta[]
  @@map("productos")
}

model Venta {
  id            Int            @id @default(autoincrement())
  total         Float
  medioPago     String         @default("Efectivo") @map("medio_pago")
  montoRecibido Float?         @map("monto_recibido")
  usuarioId     Int            @map("usuario_id")
  creadoEn      DateTime       @default(now()) @map("creado_en")
  usuario       Usuario        @relation(fields: [usuarioId], references: [id])
  detallesVenta DetalleVenta[]
  @@map("ventas")
}

model DetalleVenta {
  id             Int      @id @default(autoincrement())
  ventaId        Int      @map("venta_id")
  productoId     Int      @map("producto_id")
  cantidad       Int
  precioUnitario Float    @map("precio_unitario")
  venta          Venta    @relation(fields: [ventaId], references: [id])
  producto       Producto @relation(fields: [productoId], references: [id])
  @@map("detalles_venta")
}
```

---

# PUNTO B — FUNCIONALIDADES CORE

---

## B.1 Autenticación: Login + Registro con Bcrypt + JWT

### ¿Cómo funciona el Login?

```
1. Frontend → POST /api/auth/login { correo, contrasena }
2. auth.service busca el usuario por correo en la DB con Prisma
3. bcrypt.compare(contrasena, usuario.contrasena) → compara con el hash
4. Si coincide: jwt.sign({ id, correo, rol }, JWT_SECRET, { expiresIn: '8h' })
5. Responde: { token, user: { id, nombre, correo, rol } }
6. Frontend guarda el token en localStorage
7. En cada request: Authorization: Bearer <token>
8. auth.middleware verifica el token con jwt.verify()
```

### Código — auth.service.ts

```typescript
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// REGISTRO
export const register = async (nombre: string, correo: string, contrasena: string) => {
  const hashed = await bcrypt.hash(contrasena, 10);  // 10 = factor de costo
  return prisma.usuario.create({
    data: { nombre, correo, contrasena: hashed }
  });
};

// LOGIN
export const login = async (correo: string, contrasena: string) => {
  const usuario = await prisma.usuario.findUnique({ where: { correo } });
  if (!usuario) throw new Error('Credenciales inválidas');

  const valid = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!valid) throw new Error('Credenciales inválidas');

  const token = jwt.sign(
    { id: usuario.id, correo: usuario.correo, rol: usuario.rol },
    process.env.JWT_SECRET as string,
    { expiresIn: '8h' }
  );
  return {
    token,
    user: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol }
  };
};
```

### Código — auth.middleware.ts

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../types';

// Verifica que el token JWT sea válido
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
  if (!token) return res.status(401).json({ message: 'Token requerido' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    req.user = payload;  // agrega { id, correo, rol } al request
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Verifica que el usuario sea ADMIN
export const authorizeAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.rol !== 'ADMIN') {
    return res.status(403).json({ message: 'Sin permisos de administrador' });
  }
  next();
};
```

### Tipo AuthRequest (types/index.ts)

```typescript
import { Request } from 'express';

// Extiende Request para agregar la propiedad "user"
export interface AuthRequest extends Request {
  user?: {
    id: number;
    correo: string;
    rol: string;
  };
}
```

> **¿Por qué extender Request?**
> Express no sabe que vamos a agregar `req.user`. Si usamos `Request` normal, TypeScript daría error. Al extenderlo con `AuthRequest`, TypeScript sabe que `req.user` existe y tiene esa forma.

---

## B.2 CRUD Completo — Productos (Artículos)

El CRUD más completo del proyecto es **Productos**.

### Rutas (product.routes.ts)

```typescript
import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../middlewares/auth.middleware';
import { getAll, getById, create, update, remove } from '../controllers/product.controller';

const router = Router();

router.get('/',       authenticate,                  getAll);   // Listar todos
router.get('/:id',    authenticate,                  getById);  // Obtener uno
router.post('/',      authenticate, authorizeAdmin,  create);   // Crear (solo ADMIN)
router.put('/:id',    authenticate, authorizeAdmin,  update);   // Editar (solo ADMIN)
router.delete('/:id', authenticate, authorizeAdmin,  remove);   // Eliminar (solo ADMIN)

export default router;
```

### Controlador (product.controller.ts)

```typescript
export const create = async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.create(req.body);
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const product = await productService.update(Number(req.params.id), req.body);
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    await productService.remove(Number(req.params.id));
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
```

### Servicio (product.service.ts)

```typescript
// CREAR con código autogenerado
export const create = async (data: any) => {
  const codigo = await generateCode();
  return prisma.producto.create({
    data: { ...data, codigo },
    include: { categoria: true }
  });
};

// EDITAR
export const update = async (id: number, data: any) => {
  return prisma.producto.update({
    where: { id },
    data,
    include: { categoria: true }
  });
};

// ELIMINAR
export const remove = async (id: number) => {
  return prisma.producto.delete({ where: { id } });
};

// Genera el próximo código: 0001, 0002, 0003...
async function generateCode(): Promise<string> {
  const last = await prisma.producto.findFirst({
    where: { codigo: { not: null } },
    orderBy: { codigo: 'desc' }
  });
  const next = last?.codigo ? parseInt(last.codigo) + 1 : 1;
  return next.toString().padStart(4, '0');
}
```

---

## B.3 Venta — Transacción Prisma (lógica más importante)

```typescript
// sale.service.ts
export const createSale = async (items, medioPago, montoRecibido, usuarioId) => {

  // $transaction: si algo falla, TODO se revierte (rollback)
  return prisma.$transaction(async (tx) => {

    // PASO 1: verificar stock de cada producto
    for (const item of items) {
      const producto = await tx.producto.findUnique({ where: { id: item.productoId } });
      if (!producto || producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para: ${producto?.nombre}`);
      }
    }

    // PASO 2: calcular total
    const total = items.reduce((sum, i) => sum + i.cantidad * i.precioUnitario, 0);

    // PASO 3: crear la venta con todos sus detalles
    const venta = await tx.venta.create({
      data: {
        total, medioPago, montoRecibido, usuarioId,
        detallesVenta: { create: items }
      },
      include: {
        detallesVenta: { include: { producto: true } },
        usuario: true
      }
    });

    // PASO 4: descontar stock y alertar si queda bajo
    for (const item of items) {
      const updated = await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { decrement: item.cantidad } }
      });
      if (updated.stock <= updated.stockMinimo) {
        getIO()?.emit('low-stock', updated); // Socket.io: aviso en tiempo real
      }
    }

    return venta;
  });
};
```

> **¿Por qué usar `$transaction`?**
> Si se guarda la venta pero falla el descuento de stock, los datos quedan inconsistentes (se vendió algo que no se descontó del inventario). La transacción garantiza que o todo se ejecuta o nada queda guardado.

---

## B.4 Socket.io — Tiempo real

```typescript
// src/socket.ts
import { Server } from 'socket.io';

let _io: Server | null = null;

export const setIO = (io: Server) => { _io = io; };
export const getIO = () => _io;
```

```typescript
// src/index.ts
const io = new Server(httpServer, { cors: { origin: '*' } });
setIO(io);  // guarda la instancia globalmente

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
});
```

> **¿Por qué el patrón singleton?**
> Socket.io se crea en `index.ts` pero los servicios también necesitan emitir eventos. El singleton permite que cualquier módulo llame a `getIO()` sin importar el servidor HTTP, evitando dependencias circulares.

---

# PUNTO C — FRONTEND Y DEPLOY

---

## C.1 Frontend: React + TypeScript

### Interfaces TypeScript del frontend (types.ts)

```typescript
export interface User {
  id: number
  nombre: string
  correo: string
  rol: 'ADMIN' | 'VENDEDOR'
}
```

### Cómo se comunica el frontend con la API

```typescript
// frontend/src/config.ts
export const API_BASE = import.meta.env.VITE_API_URL ?? ''
export const API = `${API_BASE}/api`

// En cualquier página — ejemplo de llamada con autenticación:
const token = localStorage.getItem('token')

const res = await fetch(`${API}/products`, {
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
})
const data = await res.json()
```

### Navegación sin react-router

```typescript
// Dashboard.tsx
const [activePage, setActivePage] = useState('punto-venta')

const renderContent = () => {
  if (activePage === 'punto-venta') return <Ventas user={user} />
  if (activePage === 'categorias')  return <Categorias user={user} />
  if (activePage === 'articulos')   return <Articulos user={user} />
  if (activePage === 'stock')       return <Stock user={user} />
  // ...
}
```

No hay URLs, no hay react-router. El sidebar llama a `setActivePage(id)` y `renderContent()` devuelve el componente correspondiente.

---

## C.2 Deploy en Railway

**URL en producción:** https://sh-servicios-erp-production.up.railway.app

### Variables de entorno en Railway

```
DATABASE_URL = file:/app/prisma/dev.db
JWT_SECRET   = supersecretjwt123
```

### Proceso de build (nixpacks.toml)

```toml
[variables]
DATABASE_URL = "file:/app/prisma/dev.db"

[phases.install]
cmds = ["npm install"]

[phases.build]
cmds = [
  "npx prisma generate",
  "cd frontend && npm install && npm run build && cd ..",
  "npx tsc"
]

[start]
cmd = "npm run start"
```

### En producción el backend sirve el frontend

```typescript
// src/index.ts
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));        // archivos estáticos de React
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));  // SPA fallback
  });
}
```

---

# DEFENSA — PREGUNTAS Y RESPUESTAS

---

## ARQUITECTURA

**¿Qué patrón de arquitectura usaron en el backend?**
Arquitectura en capas: Rutas → Middlewares → Controladores → Servicios → Base de datos. Cada capa tiene una única responsabilidad y no conoce los detalles de la otra.

**¿Por qué separar controladores de servicios?**
El controlador maneja HTTP (req, res, status codes). El servicio contiene la lógica de negocio y no sabe que existe HTTP. Si mañana cambiamos Express por otro framework, los servicios quedan intactos.

**¿Qué es un ORM? ¿Por qué Prisma?**
Un ORM (Object-Relational Mapper) traduce entre objetos de código y tablas SQL. Prisma genera un cliente TypeScript tipado desde el `schema.prisma`: autocompletado, prevención de errores de tipos, protección contra SQL injection, y gestión de migraciones.

**¿Por qué SQLite y no PostgreSQL?**
SQLite es un archivo local, sin servidor separado. Ideal para desarrollo y proyectos pequeños. Para escalar solo se cambia el `provider` en `schema.prisma` y la `DATABASE_URL`.

---

## AUTENTICACIÓN

**¿Cómo funciona JWT?**
El servidor genera un token firmado con `JWT_SECRET` que contiene `{ id, correo, rol }`. El cliente lo guarda y lo envía en cada request en el header `Authorization`. El servidor verifica la firma con `jwt.verify()` sin consultar la base de datos.

**¿Por qué usar bcrypt?**
Bcrypt genera un hash irreversible con un salt aleatorio. Factor de costo 10 significa que calcular el hash es computacionalmente costoso, protegiendo contra ataques de fuerza bruta. Aunque alguien robe la DB, no puede recuperar la contraseña original.

**¿Diferencia entre `authenticate` y `authorizeAdmin`?**
`authenticate` verifica que el token sea válido → cualquier usuario logueado pasa. `authorizeAdmin` además verifica que `req.user.rol === 'ADMIN'` → solo admins pueden crear, editar o eliminar datos.

**¿Por qué JWT_SECRET está en `.env`?**
Porque `.env` está en `.gitignore` y no se sube al repositorio. Si el secret estuviera en el código, cualquiera que vea el repositorio podría generar tokens falsos y hacerse pasar por cualquier usuario.

**¿Por qué extender `Request` con `AuthRequest`?**
Express no tiene la propiedad `user` en `Request`. Al extenderla con `AuthRequest`, TypeScript sabe que `req.user` existe y tiene la forma `{ id, correo, rol }`, dando tipado fuerte en todos los controladores sin usar `any`.

---

## BASE DE DATOS

**¿Por qué guardar `precioUnitario` en `DetalleVenta`?**
Si el precio de un producto cambia después de la venta, los comprobantes históricos quedarían con el precio incorrecto. Guardar el precio en el momento de la venta preserva la integridad histórica del comprobante.

**¿Qué es una transacción? ¿Por qué se usa en la creación de ventas?**
Una transacción agrupa múltiples operaciones en una unidad atómica: o todas se ejecutan o ninguna (rollback). Si se guardara la venta pero fallara el descuento de stock, los datos quedarían inconsistentes. La transacción garantiza que eso no ocurra.

**¿Qué hace `@updatedAt`?**
Directiva de Prisma que actualiza automáticamente el campo con la fecha y hora actual cada vez que se modifica el registro. No hay que hacerlo manualmente.

**¿Qué hace `@@map`?**
Define el nombre real de la tabla en la base de datos. El modelo se llama `Venta` (PascalCase) pero la tabla SQL se llama `ventas` (plural, snake_case), que es la convención estándar de SQL.

**¿Qué es `upsert`?**
"Insert or update": si el registro existe (por su clave única), no lo toca; si no existe, lo crea. Se usa en el seed para poder ejecutarlo múltiples veces sin duplicar datos.

---

## TYPESCRIPT

**¿Qué ventaja da TypeScript sobre JavaScript?**
Detección de errores en tiempo de compilación, autocompletado en el editor, interfaces que documentan la forma de los datos, y refactoring más seguro. En un proyecto con múltiples capas, garantiza que los datos tengan la forma correcta al pasar entre funciones.

**¿Qué son los tipos `string`, `number`, `boolean` en TypeScript?**
Son los tipos primitivos básicos. TypeScript además permite `string[]` (array de strings), `number | null` (union type: puede ser número o null), e interfaces para objetos. El símbolo `?` en un campo indica que es opcional.

**¿Qué es un `enum`?**
Un conjunto de valores nombrados. En el proyecto: `enum Rol { ADMIN, VENDEDOR }`. Solo se puede asignar uno de esos dos valores al campo `rol`, TypeScript lo valida en tiempo de compilación.

---

## SOCKET.IO

**¿Para qué se usa Socket.io en este proyecto?**
Para notificar al frontend en tiempo real cuando un producto queda con stock bajo después de una venta, sin que el cliente tenga que consultar periódicamente. El servidor emite el evento `'low-stock'` y todos los clientes conectados lo reciben instantáneamente.

**¿Por qué el patrón singleton en `socket.ts`?**
La instancia de Socket.io se crea en `index.ts` pero los servicios también necesitan emitir eventos. El singleton guarda la instancia globalmente. Cualquier módulo llama a `getIO()` sin saber nada del servidor HTTP, evitando dependencias circulares.

---

## FRONTEND

**¿Cómo funciona la navegación sin react-router?**
`Dashboard.tsx` mantiene un estado `activePage`. El sidebar cambia ese estado al hacer clic. `renderContent()` devuelve el componente correspondiente según ese estado. Es una SPA con navegación interna sin cambios de URL.

**¿Cómo el frontend sabe si el usuario es ADMIN o VENDEDOR?**
El JWT contiene el `rol` en su payload. Al hacer login, el servidor devuelve `{ token, user: { rol } }`. El frontend guarda el `user` en el estado y lo pasa a los componentes. Los componentes muestran u ocultan funciones según `user.rol === 'ADMIN'`.

---

## PREGUNTAS DE DISEÑO

**¿Qué mejorarías del proyecto?**
- Paginación en el endpoint GET /sales (ahora carga todo)
- Pasar de SQLite a PostgreSQL para concurrencia real en producción
- Mover el JWT de localStorage a cookie HttpOnly (más seguro contra XSS)
- Agregar tests unitarios a los servicios
- Soft delete en ventas (campo `anulada`) en vez de no poder cancelarlas

**¿Qué es un ERP?**
Enterprise Resource Planning: sistema integrado de gestión empresarial. Módulos típicos: Ventas, Compras, Inventario, Contabilidad, RRHH. Este proyecto implementa el módulo de Ventas con base de Inventario. Los módulos de Alquiler y Servicios Técnicos están en desarrollo.

---

# DATOS DEL SISTEMA

## Usuarios de prueba

| Correo | Contraseña | Rol |
|---|---|---|
| admin@shservicios.com | admin123 | ADMIN |
| vendedor@shservicios.com | vendedor123 | VENDEDOR |

**ADMIN:** puede crear, editar y eliminar categorías y productos. Ve todos los módulos.
**VENDEDOR:** solo puede realizar ventas y consultar el inventario.

## Scripts npm

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el backend con recarga automática |
| `npm run build` | Compila frontend + backend para producción |
| `npm start` | Ejecuta el build de producción |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:generate` | Regenera el cliente Prisma |
| `npm run db:studio` | Abre Prisma Studio (interfaz visual de la DB) |
| `npm run db:seed` | Carga datos iniciales |

## Variables de entorno (.env)

```
DATABASE_URL="file:./dev.db"    ← Ruta al archivo SQLite
JWT_SECRET="supersecretjwt123"  ← Clave para firmar/verificar JWT
```
