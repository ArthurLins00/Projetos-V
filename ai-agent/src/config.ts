import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Carrega ai-agent/.env independentemente da pasta de onde o comando foi executado.
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(raiz, '.env'), quiet: true });

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';
// Requisições por minuto permitidas pela cota da chave (plano gratuito: 15; alguns modelos têm menos)
export const GEMINI_RPM = Math.max(1, Number(process.env.GEMINI_RPM) || 15);

export function getApiKey(): string | undefined {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key && key !== 'coloque_sua_chave_aqui' ? key : undefined;
}

export function requireApiKey(): string {
  const key = getApiKey();
  if (!key) {
    console.error(
      '\n[ERRO] GEMINI_API_KEY não configurada.\n' +
        '  1. Copie o modelo:   cp .env.example .env\n' +
        '  2. Cole sua chave do Google AI Studio (https://aistudio.google.com/apikey) no arquivo .env\n',
    );
    process.exit(1);
  }
  return key;
}

// ── Modo servidor (integração com o app via backend) ──
export const FISCALIZE_API_URL = process.env.FISCALIZE_API_URL?.trim() || 'http://localhost:3000';
// Só escuta na própria máquina por padrão: quem fala com o agente é o backend, não o celular.
export const AI_AGENT_HOST = process.env.AI_AGENT_HOST?.trim() || '127.0.0.1';
export const AI_AGENT_PORT = Number(process.env.AI_AGENT_PORT) || 3333;
export const AI_AGENT_SECRET = process.env.AI_AGENT_SECRET?.trim() || undefined;
