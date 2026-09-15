import bcrypt from "bcryptjs";
import { authService } from "../services/authService";
import { prisma } from "../config/prisma";

jest.mock("bcryptjs");

describe("AuthService - Login inválido", () => {
  it("deve retornar erro 401 quando a senha estiver incorreta", async () => {
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

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      authService.login("teste@email.com", "senha-incorreta"),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Credenciais inválidas.",
    });

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: {
        email: "teste@email.com",
      },
    });

    expect(bcrypt.compare).toHaveBeenCalledWith(
      "senha-incorreta",
      "senha-hash",
    );
  });
});
