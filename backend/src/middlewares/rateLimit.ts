import { NextFunction, Request, Response } from 'express';
import { AppError } from './errorMiddleware';
import { attemptStore } from '../utils/attemptStore';

type RateLimitOptions = {
  name: string;
  windowMs: number;
  // Lido a cada requisição, para a variável de ambiente valer sem reiniciar os testes
  max: () => number;
  message: string;
};

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Limite de requisições por IP com janela fixa. Responde 429 com Retry-After e, se o contador
// falhar, deixa a requisição passar (o limite protege a API, não pode derrubá-la).
export function rateLimit({ name, windowMs, max, message }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const limit = max();
    if (limit <= 0) return next();

    try {
      const { count, resetAt } = await attemptStore.hit(`rl:${name}:${req.ip}`, windowMs);
      const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - count)));
      res.setHeader('RateLimit-Reset', String(retryAfter));

      if (count > limit) {
        res.setHeader('Retry-After', String(retryAfter));
        return next(new AppError(429, message));
      }
    } catch {
      // segue sem limite
    }

    next();
  };
}

// Toda a API: protege contra varreduras e excesso de chamadas de um mesmo IP
export const globalRateLimit = rateLimit({
  name: 'global',
  windowMs: 60 * 1000,
  max: () => envNumber('RATE_LIMIT_GLOBAL_MAX', 300),
  message: 'Muitas requisições. Aguarde um instante e tente novamente.',
});

// Rotas de autenticação sem sessão (login, 2FA, cadastro e recuperação de senha)
export const authRateLimit = rateLimit({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: () => envNumber('RATE_LIMIT_AUTH_MAX', 100),
  message: 'Muitas tentativas de autenticação a partir desta rede. Tente novamente em alguns minutos.',
});
