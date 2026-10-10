import { Response } from 'express';
import { AuthRequest } from '../types';
import * as saleService from '../services/sale.service';
import { mensajeSeguro } from '../utils/http';
import { auditar } from '../utils/auditoria';

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

// Registra una venta a nombre del usuario logueado (sale del token, no del body)
export const create = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user!.id;
    const { items, medioPago, montoRecibido, clienteId, usarSaldo, tipoComprobante } = req.body;
    if (!items || !items.length) {
      res.status(400).json({ message: 'El comprobante no tiene productos' });
      return;
    }
    const venta = await saleService.createSale(
      usuarioId, items, medioPago ?? 'Efectivo', montoRecibido ?? null, clienteId ?? null, usarSaldo !== false, tipoComprobante ?? 'FACTURA',
    );
    auditar(req, {
      accion: 'create', seccion: 'ventas', entidad: 'venta', entidadId: venta.id ?? undefined,
      descripcion: `Registró ${venta.tipoComprobante === 'REMITO' ? 'el remito' : 'la factura'} N° ${venta.numero} por ${pesos(venta.total)} (${venta.medioPago})`,
    });
    res.status(201).json(venta);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const getAll = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json(await saleService.getAll());
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await saleService.remove(id);
    auditar(req, { accion: 'delete', seccion: 'ventas', entidad: 'venta', entidadId: id, descripcion: `Anuló la venta #${id} (se devolvió el stock y se revirtió la deuda)` });
    res.status(204).send();
  } catch (err: any) {
    res.status(err.message === 'Venta no encontrada' ? 404 : 400).json({ message: mensajeSeguro(err) });
  }
};
