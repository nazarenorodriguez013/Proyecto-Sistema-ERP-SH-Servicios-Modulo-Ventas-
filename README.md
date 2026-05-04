# Proyecto-Sistema-ERP SH-Servicios-Modulo-Ventas
Sistema de Gestión

El presente proyecto consiste en el desarrollo de un sistema ERP especializado en la Gestión de Ventas e Inventario para la empresa SH Servicios. La organización, dedicada a la provisión de insumos y soluciones técnicas, requiere de una herramienta digital que centralice sus operaciones comerciales. El sistema busca sustituir procesos manuales por una plataforma automatizada que garantice el control total sobre el flujo de mercadería y la transparencia financiera.

2. Objetivos del Proyecto
El objetivo principal es implementar una solución Full-Stack que resuelva la desincronización de inventario. El sistema permitirá:

Digitalizar el catálogo de productos y el proceso de facturación.

Automatizar la reducción de existencias ante cada venta.

Garantizar la integridad de los datos mediante una arquitectura robusta y segura.

3. Alcance Funcional
El sistema se centra en dos pilares críticos para el funcionamiento de SH Servicios:

Gestión de Inventario (ABM): Un módulo completo para el control de artículos. Permite el alta, baja, modificación y consulta de productos, categorías y niveles de stock mínimo.

Venta Transaccional y Facturación: Interfaz para procesar ventas que vincula múltiples productos, calcula totales automáticamente y genera el registro de la operación.

Control de Stock en Tiempo Real: Validación de disponibilidad antes de la venta y descuento automático de unidades en la base de datos al confirmar la transacción.

Seguridad y Acceso: Sistema de autenticación con JWT y roles de usuario, asegurando que solo personal autorizado pueda modificar el inventario o ver el registro de ventas.

4. Stack Tecnológico
Para cumplir con los requisitos de alta disponibilidad y robustez técnica, se ha seleccionado el siguiente stack:

Backend: Node.js con Express y TypeScript (Arquitectura de capas: Controllers, Services, Routes).

Base de Datos: PostgreSQL administrado a través de Prisma ORM para asegurar un tipado estricto de los modelos de datos.

Frontend: React con TypeScript, enfocado en una experiencia de usuario ágil y responsive.

Comunicación Real-time (Plus de Promoción): Uso de WebSockets (Socket.io) para notificar instantáneamente la actualización de stock en todos los terminales cuando se realiza una venta.

5. Arquitectura de Datos (DER)
El sistema se apoya en una estructura relacional de 5 tablas clave:

Users: Gestión de credenciales y perfiles de acceso.

Categories: Clasificación organizada de los productos de SH Servicios.

Products: Registro maestro de artículos (precios, descripción y stock).

Sales: Registro de cabecera de cada venta (fecha, total, usuario).

SaleDetails: Detalle de los artículos y cantidades incluidas en cada venta.

6. Despliegue en la Nube
La aplicación será desplegada íntegramente en entornos cloud para garantizar su acceso remoto:

Infraestructura: Render / Vercel.

Persistencia: Neon.tech (PostgreSQL Serverless).

Conclusión
Este sistema proporciona a SH Servicios una herramienta técnica avanzada para el control de su activo más importante: el stock. La integración de WebSockets y la arquitectura en TypeScript aseguran una plataforma escalable, rápida y libre de errores de sincronización, cumpliendo con los máximos estándares de desarrollo actuales.
