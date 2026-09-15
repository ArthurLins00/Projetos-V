import { describe, it, beforeAll, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app'; 
import { prisma } from '../config/prisma'; 

describe('AUT-10 | Realizar logout e revogar refresh token | RF04 (E2E)', () => {
    let accessToken: string;
    let refreshToken: string;
  
    // Fecha a conexão com o banco após os testes
    afterAll(async () => {
      await prisma.$disconnect();
    });
  
    beforeAll(async () => {
      const response = await request(app)
        .post('/auth/login') 
        .send({
          email: 'usuario.teste@example.com', // PRECISA ser um email que exista no seu banco local!
          senha: 'senhaSegura123'             // Alterado de 'password' para 'senha'
        });
  
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });
  
    it('deve realizar o logout com sucesso', async () => {
      const logoutResponse = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });
  
      expect(logoutResponse.status).toBe(200); 
    });
  
    it('não deve permitir o uso de um token após o logout', async () => {
      // Alterado de /usuarios/me para /users (que deve existir no seu userRoutes)
      const protectedRouteResponse = await request(app)
        .get('/users') 
        .set('Authorization', `Bearer ${accessToken}`);
  
      expect(protectedRouteResponse.status).toBe(401);
    });
  });