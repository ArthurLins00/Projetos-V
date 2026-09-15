import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

import authRoutes from "../routes/authRoutes";
import { errorHandler } from "../middlewares/errorMiddleware";
import { prisma } from "../config/prisma";

jest.mock("bcryptjs");

const app = express();

app.use(express.json());
app.use("/auth", authRoutes);
app.use(errorHandler);

describe("Login - Senha incorreta", () => {
  it("deve retornar 401 quando o usuário informar uma senha incorreta", async () => {
    // Simula um usuário existente e ativo
    prisma.usuario.findUnique.mockResolvedValue({
      id: "uuid-123",
      nome: "Usuário Teste",
      email: "teste@email.com",
      senha: "senha-hash",
      perfil: "Cidadao",
      status: "Ativo",
      criadoem: new Date(),
      atualizadoem: new Date(),
    });

    // A senha informada não corresponde à senha armazenada
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const response = await request(app).post("/auth/login").send({
      email: "teste@email.com",
      senha: "senha-incorreta",
    });

    expect(response.status).toBe(401);

    expect(response.body).toMatchObject({
      error: "Credenciais inválidas.",
      statusCode: 401,
    });

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "senha-incorreta",
      "senha-hash",
    );
  });
});
