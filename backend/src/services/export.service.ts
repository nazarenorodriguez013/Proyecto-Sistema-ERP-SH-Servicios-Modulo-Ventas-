import { PrismaClient, TipoProducto } from '@prisma/client';
import { httpError } from '../utils/http';
import * as clientService from './client.service';
import * as auditService from './audit.service';

const prisma = new PrismaClient();

// Datos de cada exportación como columnas + filas; el frontend arma con eso el Excel, el CSV o el PDF.
// "principales" son las columnas que van al PDF (el Excel y el CSV llevan todas), igual que en el catálogo.
type Tabla = { titulo: string; columnas: string[]; principales: string[]; filas: (string | number | null)[][] };

export const DATASETS: Record<string, string> = {
  maquinaria: 'Maquinaria', repuestos: 'Repuestos', precios: 'Lista de precios', clientes: 'Clientes',
  ventas: 'Ventas', servicios: 'Servicios técnicos', auditoria: 'Auditoría',
};

const fecha = (d: Date | null) => d ? d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '';
const margen = (costo: number, precio: number) => costo ? Math.round((precio - costo) / costo * 10000) / 100 : null;

// Mismas columnas que la plantilla de importación, así un archivo exportado se puede editar y volver a importar
const productos = async (tipo: TipoProducto, conCostos: boolean, titulo: string): Promise<Tabla> => {
  const lista = await prisma.producto.findMany({ where: { tipoProducto: tipo }, include: { categoria: true }, orderBy: { nombre: 'asc' } });
  const columnas = ['codigo', 'nombre', 'descripcion', 'categoria', ...(conCostos ? ['costo', 'ganancia'] : []), 'precio', 'stock', 'stock_minimo', 'activo'];
  return {
    titulo, columnas, principales: ['codigo', 'nombre', 'categoria', 'precio', 'stock', 'activo'],
    filas: lista.map(p => [
      p.codigo, p.nombre, p.descripcion, p.categoria.nombre,
      ...(conCostos ? [p.precioCosto, margen(p.precioCosto, p.precio)] : []),
      p.precio, p.stock, p.stockMinimo, p.activo ? 'si' : 'no',
    ]),
  };
};

export const obtener = async (dataset: string, permisos: string[]): Promise<Tabla> => {
  const conCostos = permisos.includes('productos.costos');
  switch (dataset) {
    case 'maquinaria': return productos('MAQUINARIA', conCostos, DATASETS.maquinaria);
    case 'repuestos':  return productos('REPUESTO', conCostos, DATASETS.repuestos);

    case 'precios': {
      const lista = await prisma.producto.findMany({ where: { activo: true }, include: { categoria: true }, orderBy: [{ tipoProducto: 'asc' }, { nombre: 'asc' }] });
      const columnas = ['Código', 'Producto', 'Tipo', 'Categoría', ...(conCostos ? ['Costo', 'Ganancia %'] : []), 'Precio'];
      return {
        titulo: DATASETS.precios, columnas, principales: ['Código', 'Producto', 'Categoría', 'Precio'],
        filas: lista.map(p => [
          p.codigo, p.nombre, p.tipoProducto === 'MAQUINARIA' ? 'Maquinaria' : 'Repuesto', p.categoria.nombre,
          ...(conCostos ? [p.precioCosto, margen(p.precioCosto, p.precio)] : []), p.precio,
        ]),
      };
    }

    case 'clientes': {
      const lista = await clientService.getAll();
      return {
        titulo: DATASETS.clientes,
        columnas: ['Nombre', 'Documento', 'Condición IVA', 'Teléfono', 'Email', 'Dirección', 'Saldo (+ debe / - a favor)'],
        principales: ['Nombre', 'Documento', 'Teléfono', 'Saldo (+ debe / - a favor)'],
        filas: lista.map(c => [c.nombre, c.documento, c.condicionIva, c.telefono, c.email, c.direccion, Math.round(c.saldo * 100) / 100]),
      };
    }

    case 'ventas': {
      const lista = await prisma.venta.findMany({
        include: { cliente: true, usuario: { select: { nombre: true } }, detallesVenta: true },
        orderBy: { creadoEn: 'desc' },
      });
      return {
        titulo: DATASETS.ventas,
        columnas: ['Fecha', 'Comprobante', 'Número', 'Cliente', 'Vendedor', 'Medio de pago', 'Productos', 'Saldo aplicado', 'Total'],
        principales: ['Fecha', 'Comprobante', 'Número', 'Cliente', 'Medio de pago', 'Total'],
        filas: lista.map(v => [
          fecha(v.creadoEn), v.tipoComprobante === 'FACTURA' ? 'Factura' : 'Remito', v.numero, v.cliente?.nombre ?? 'Consumidor Final',
          v.usuario.nombre, v.medioPago, v.detallesVenta.map(d => `${d.cantidad} x ${d.nombreProducto}`).join(' | '), v.saldoAplicado, v.total,
        ]),
      };
    }

    case 'servicios': {
      const lista = await prisma.servicioTecnico.findMany({ include: { cliente: true, tecnico: { select: { nombre: true } } }, orderBy: { fechaIngreso: 'desc' } });
      return {
        titulo: DATASETS.servicios,
        columnas: ['Número', 'Ingreso', 'Cliente', 'Equipo', 'Falla', 'Técnico', 'Estado', 'Garantía', 'Mano de obra', 'Medio de pago', 'Total', 'Finalizado'],
        principales: ['Número', 'Ingreso', 'Cliente', 'Equipo', 'Técnico', 'Estado', 'Total'],
        filas: lista.map(s => [
          s.id, fecha(s.fechaIngreso), s.cliente.nombre, s.equipo, s.descripcionFalla, s.tecnico?.nombre ?? 'Sin asignar',
          s.estado === 'FINALIZADO' ? 'Finalizado' : 'En curso', s.enGarantia ? 'si' : 'no', s.costoManoObra, s.medioPago, s.total, fecha(s.finalizadoEn),
        ]),
      };
    }

    case 'auditoria': {
      const lista = await auditService.todos({});
      return {
        titulo: DATASETS.auditoria,
        columnas: ['Fecha', 'Usuario', 'Acción', 'Sección', 'Descripción', 'IP', 'Cambios'],
        principales: ['Fecha', 'Usuario', 'Acción', 'Sección', 'Descripción'],
        filas: lista.map(a => [fecha(a.creadoEn), a.usuarioNombre ?? 'Sistema', a.accion, a.seccion, a.descripcion, a.ip, a.datos ? JSON.stringify(a.datos) : '']),
      };
    }

    default: throw httpError(404, 'No existe esa exportación');
  }
};
