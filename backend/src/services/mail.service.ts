import nodemailer from 'nodemailer';

// Si el servidor no tiene SMTP configurado, el mail no sale: el link queda en el log del servidor
// para que el administrador pueda pasárselo al usuario a mano
export const enviarMail = async (para: string, asunto: string, texto: string) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST) {
    console.log(`[mail sin SMTP configurado] Para: ${para}\nAsunto: ${asunto}\n${texto}`);
    return false;
  }
  const transporte = nodemailer.createTransport({
    host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  await transporte.sendMail({ from: SMTP_FROM || SMTP_USER, to: para, subject: asunto, text: texto });
  return true;
};
