import nodemailer from 'nodemailer';

// Orden de preferencia: Resend (API web, funciona en Railway), SMTP, o solo el log del servidor
export const enviarMail = async (para: string, asunto: string, texto: string) => {
  const { RESEND_API_KEY, MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM || 'SH Servicios <onboarding@resend.dev>', to: [para], subject: asunto, text: texto }),
    });
    if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
    return true;
  }

  if (SMTP_HOST) {
    const transporte = nodemailer.createTransport({
      host: SMTP_HOST, port: Number(SMTP_PORT) || 587, secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });
    await transporte.sendMail({ from: MAIL_FROM || SMTP_FROM || SMTP_USER, to: para, subject: asunto, text: texto });
    return true;
  }

  // Sin proveedor configurado el mail no sale: el link queda en el log para pasárselo al usuario a mano
  console.log(`[mail sin proveedor configurado] Para: ${para}\nAsunto: ${asunto}\n${texto}`);
  return false;
};
