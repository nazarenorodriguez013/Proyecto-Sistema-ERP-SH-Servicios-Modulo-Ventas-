import { NextFunction, Request, Response } from 'express';

// Error con el código HTTP que corresponde, para que el controller no tenga que adivinarlo
export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

// Dirección pública de la app para armar links de mail (APP_URL, o la desde la que llegó el pedido)
export const urlBase = (req: Request) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`;

// Los errores que lanzamos nosotros son Error comunes con un mensaje pensado para el usuario.
// Cualquier otro (Prisma, TypeError, etc.) es interno: se registra y se responde algo genérico para no filtrar detalles de la base
export const mensajeSeguro = (err: any): string => {
  if (err && (err.status || err.constructor === Error)) return err.message;
  console.error('Error interno:', err);
  return 'Los datos enviados no son válidos';
};

// Un JSON mal formado devuelve un 400 en JSON, no la página de error de Express con el stack
export const errorJson = (err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') { res.status(400).json({ message: 'El cuerpo del pedido no es un JSON válido' }); return; }
  if (err?.type === 'entity.too.large') { res.status(413).json({ message: 'El pedido es demasiado grande' }); return; }
  next(err);
};

// Ejecuta la acción y responde con su resultado, o con el código HTTP que trae el error (400 si no trae ninguno)
export const responder = async (res: Response, accion: () => Promise<unknown>, status = 200) => {
  try {
    const resultado = await accion();
    if (status === 204) res.status(204).send();
    else res.status(status).json(resultado);
  } catch (err: any) {
    res.status(err.status ?? 400).json({ message: mensajeSeguro(err) });
  }
};
