import { Response } from 'express';

// Error con el código HTTP que corresponde, para que el controller no tenga que adivinarlo
export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

// Ejecuta la acción y responde con su resultado, o con el código HTTP que trae el error (400 si no trae ninguno)
export const responder = async (res: Response, accion: () => Promise<unknown>, status = 200) => {
  try {
    const resultado = await accion();
    if (status === 204) res.status(204).send();
    else res.status(status).json(resultado);
  } catch (err: any) {
    res.status(err.status ?? 400).json({ message: err.message });
  }
};
