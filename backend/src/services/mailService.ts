import nodemailer, { Transporter } from 'nodemailer';
import { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, isProduction } from '../config/env';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      ...(SMTP_USER && { auth: { user: SMTP_USER, pass: SMTP_PASS } }),
    });
  }
  return transporter;
}

export const mailService = {
  async send(to: string, subject: string, text: string) {
    const transport = getTransporter();

    if (!transport) {
      if (isProduction) {
        throw new Error('SMTP_HOST não configurado: não é possível enviar e-mails.');
      }
      console.log(`[Mail] SMTP não configurado — e-mail para ${to}\nAssunto: ${subject}\n${text}`);
      return;
    }

    await transport.sendMail({ from: MAIL_FROM, to, subject, text });
  },
};
