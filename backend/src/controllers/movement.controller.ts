import { Response } from 'express';
import { AuthRequest } from '../types';
import * as movementService from '../services/movement.service';
import { mensajeSeguro } from '../utils/http';
import { auditar } from '../utils/auditoria';

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;

// Desde la cuenta del cliente solo se registran pagos: las deudas las genera el punto de venta
export const createPago = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clienteId = Number(req.params.id);
    const monto = Number(req.body.monto);
    const movimiento = await movementService.createPago(clienteId, monto, req.user!);
    auditar(req, { accion: 'create', seccion: 'clientes', entidad: 'cliente', entidadId: clienteId, descripcion: `Registró un pago de ${pesos(monto)} en la cuenta corriente del cliente #${clienteId}` });
    res.status(201).json(movimiento);
  } catch (err: any) {
    res.status(400).json({ message: mensajeSeguro(err) });
  }
};

export const remove = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const movementId = Number(req.params.movementId);
    const m = await movementService.remove(Number(req.params.id), movementId, req.user!, req.body?.motivo);
    auditar(req, {
      accion: 'delete', seccion: 'clientes', entidad: 'movimiento', entidadId: movementId,
      descripcion: `Eliminó un pago de ${pesos(m.monto)} de la cuenta corriente de ${m.cliente.nombre}`,
      datos: {
        cliente: m.cliente.nombre, monto: m.monto, concepto: m.concepto, cargadoEl: m.creadoEn.toISOString(),
        ...(m.registradoPorNombre ? { cargadoPor: m.registradoPorNombre } : {}),
        ...(m.motivoEliminacion ? { motivo: m.motivoEliminacion } : {}),
      },
    });
    res.status(204).send();
  } catch (err: any) {
    res.status(err.message === 'Movimiento no encontrado' ? 404 : 400).json({ message: mensajeSeguro(err) });
  }
};
