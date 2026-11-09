import helmet from 'helmet';

// Cabeçalhos de segurança (Atividade 4): HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy e CSP.
// As fotos em /uploads podem ser exibidas por um front em outra origem (a CORS decide quem lê a API),
// por isso a Cross-Origin-Resource-Policy fica em cross-origin.
export const securityHeaders = helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

// O Swagger UI (/docs) carrega scripts e estilos do unpkg e tem um script inline de inicialização
export const docsContentSecurityPolicy = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
    imgSrc: ["'self'", 'data:', 'https://unpkg.com'],
    connectSrc: ["'self'"],
  },
});

// Atrás de um proxy reverso (Caddy, Nginx, balanceador), o IP do cliente vem no X-Forwarded-For.
// Sem isto, o rate limit veria todos os usuários com o IP do proxy. Valores: vazio (desligado),
// um número de proxies (ex.: 1), "true" ou uma lista de IPs/sub-redes aceita pelo Express.
export function trustProxySetting(value = process.env.TRUST_PROXY): boolean | number | string | undefined {
  const raw = value?.trim();
  if (!raw || raw === 'false') return undefined;
  if (raw === 'true') return true;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : raw;
}
