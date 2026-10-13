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
export const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

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
