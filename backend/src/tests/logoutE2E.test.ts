import { describe, it, beforeAll, expect } from '@jest/globals';
import request from 'supertest';
import { app } from '../app'; 
import { prisma } from '../config/prisma'; 

describe('AUT-10 | Realizar logout e revogar refresh token | RF04 (E2E)', () => {
  let accessToken: string;
  let refreshToken: string;

  // Antes de testar o logout, precisamos de um usuário logado
  beforeAll(async () => {
    // Exemplo: Fazendo login para obter os tokens (ajuste as credenciais e a rota conforme seu backend)
    const response = await request(app)
      .post('/auth/login') 
      .send({
        email: 'usuario.teste@example.com',
        password: 'senhaSegura123'
      });

    accessToken = response.body.accessToken;
    refreshToken = response.body.refreshToken;
  });

  it('deve realizar o logout com sucesso', async () => {
    // Ação: Chama a rota de logout passando o token de acesso e o refresh token
    const logoutResponse = await request(app)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });

    // Validação 1: O status da resposta deve ser 200 OK (ou 204 No Content, dependendo da sua API)
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('message', 'Logout realizado com sucesso'); // Ajuste conforme o retorno da sua API
  });

  it('não deve permitir o uso de um token após o logout', async () => {
    // Validação 2: Tentar acessar uma rota protegida com o token que acabou de ser revogado
    const protectedRouteResponse = await request(app)
      .get('/usuarios/me') // Substitua por qualquer rota protegida do seu sistema
      .set('Authorization', `Bearer ${accessToken}`);

    // Deve retornar 401 Unauthorized
    expect(protectedRouteResponse.status).toBe(401);
  });
});