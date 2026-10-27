import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProduction = NODE_ENV === 'production';

export const JWT_SECRET = requireEnv('JWT_SECRET');
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
export const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;

export const PORT = Number(process.env.PORT) || 3000;

export function getAllowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && fromEnv.length === 0) {
    throw new Error('Missing required environment variable: ALLOWED_ORIGINS');
  }

  return fromEnv;
}

export const AI_AGENT_URL = (process.env.AI_AGENT_URL?.trim() || 'http://127.0.0.1:3333').replace(/\/$/, '');
export const AI_AGENT_SECRET = process.env.AI_AGENT_SECRET?.trim() || '';

export const SMTP_HOST = process.env.SMTP_HOST?.trim() || '';
export const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
export const SMTP_USER = process.env.SMTP_USER?.trim() || '';
export const SMTP_PASS = process.env.SMTP_PASS || '';
// MAIL_FROM pode trazer só o nome ("Fiscalize"); sem endereço o Gmail descarta a mensagem, então usamos a conta do SMTP
export function resolveMailFrom(mailFrom: string | undefined, smtpUser: string) {
  const value = mailFrom?.trim() || 'Fiscalize';
  if (value.includes('@')) return value;
  return `${value} <${smtpUser || 'no-reply@fiscalize.gov.br'}>`;
}

export const MAIL_FROM = resolveMailFrom(process.env.MAIL_FROM, SMTP_USER);

// Modo de demonstração: devolve o código da verificação em duas etapas na resposta do login
// e avisa no cadastro quando a senha escolhida já pertence a outra conta
export const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (DEMO_MODE && isProduction) {
  throw new Error('DEMO_MODE não pode ser usado em produção.');
}
