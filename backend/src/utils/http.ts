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

// Los comprobantes guardan el artículo como texto (nombre y código al momento de la operación): al responder se arma el
// mismo formato de siempre (producto.nombre / producto.codigo) con ese texto, para que la hoja salga igual aunque el artículo cambie o se elimine
export const conTextoDelArticulo = (valor: any): any => {
  if (Array.isArray(valor)) return valor.map(conTextoDelArticulo);
  if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    const copia: any = {};
    for (const k of Object.keys(valor)) copia[k] = conTextoDelArticulo(valor[k]);
    if (typeof valor.nombreProducto === 'string' && 'productoId' in valor)
      copia.producto = { ...(valor.producto ?? {}), id: valor.productoId, nombre: valor.nombreProducto, codigo: valor.codigoProducto ?? null };
    return copia;
  }
  return valor;
};

export const textoDelArticulo = (_req: Request, res: Response, next: NextFunction) => {
  const json = res.json.bind(res);
  res.json = (cuerpo: any) => json(conTextoDelArticulo(cuerpo));
  next();
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
