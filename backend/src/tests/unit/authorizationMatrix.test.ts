import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { requireRole } from '../../middlewares/requireRole';

const app = express();

app.use((req: Request, res: Response, next: NextFunction) => {
  const perfil = req.headers['x-mock-perfil'] as string;
  if (perfil) {
    req.user = { id: 'uuid-123', email: 'teste@exemplo.com', perfil };
  }
  next();
});

app.get('/rota-admin', requireRole(['Admin']), (req, res) => {
  res.status(200).json({ message: 'Acesso liberado para Admin' });
});

app.get('/rota-gestor', requireRole(['Gestor']), (req, res) => {
  res.status(200).json({ message: 'Acesso liberado para Gestor' });
});

app.get('/rota-cidadao', requireRole(['Cidadao']), (req, res) => {
  res.status(200).json({ message: 'Acesso liberado para Cidadão' });
});


describe('Prioridade 1: Matriz de Autorização por Perfil', () => {

  describe('Perfil: Admin', () => {
    it('deve permitir acesso à rota exclusiva de Admin', async () => {
      const res = await request(app).get('/rota-admin').set('x-mock-perfil', 'Admin');
      expect(res.status).toBe(200);
    });

    it('deve permitir acesso à rota de Gestor (herdado)', async () => {
      const res = await request(app).get('/rota-gestor').set('x-mock-perfil', 'Admin');
      expect(res.status).toBe(200);
    });

    it('deve permitir acesso à rota de Cidadão (herdado)', async () => {
      const res = await request(app).get('/rota-cidadao').set('x-mock-perfil', 'Admin');
      expect(res.status).toBe(200);
    });
  });

  describe('Perfil: Gestor', () => {
    it('deve BLOQUEAR (403) acesso à rota de Admin', async () => {
      const res = await request(app).get('/rota-admin').set('x-mock-perfil', 'Gestor');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Seu perfil não tem permissão/i);
    });

    it('deve permitir acesso à rota exclusiva de Gestor', async () => {
      const res = await request(app).get('/rota-gestor').set('x-mock-perfil', 'Gestor');
      expect(res.status).toBe(200);
    });

    it('deve permitir acesso à rota de Cidadão (herdado)', async () => {
      const res = await request(app).get('/rota-cidadao').set('x-mock-perfil', 'Gestor');
      expect(res.status).toBe(200);
    });
  });

  describe('Perfil: Cidadão', () => {
    it('deve BLOQUEAR (403) acesso à rota de Admin', async () => {
      const res = await request(app).get('/rota-admin').set('x-mock-perfil', 'Cidadao');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Seu perfil não tem permissão/i);
    });

    it('deve BLOQUEAR (403) acesso à rota de Gestor', async () => {
      const res = await request(app).get('/rota-gestor').set('x-mock-perfil', 'Cidadao');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Seu perfil não tem permissão/i);
    });

    it('deve permitir acesso à rota exclusiva de Cidadão', async () => {
      const res = await request(app).get('/rota-cidadao').set('x-mock-perfil', 'Cidadao');
      expect(res.status).toBe(200);
    });
  });

  describe('Cenários sem perfil definido', () => {
    it('deve BLOQUEAR (401) acesso quando o usuário não estiver autenticado (sem perfil)', async () => {
      const res = await request(app).get('/rota-admin');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Faça login para acessar/i);
    });
  });

});
