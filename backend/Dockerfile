# API do Fiscalize (Express + Prisma). Guia: docs/COMO_RODAR_COM_DOCKER.md
FROM node:22-bookworm-slim

# O engine do Prisma precisa do OpenSSL; o curl não é necessário (o healthcheck usa o fetch do Node)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências primeiro, para reaproveitar o cache da camada quando só o código muda.
# As de desenvolvimento ficam: o Prisma CLI aplica as migrações e o ts-node roda o seed na subida.
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000

# Na subida: aplica as migrações pendentes, popula o banco (o seed não duplica dados) e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && if [ \"$SEED_ON_START\" = \"true\" ]; then npm run seed; fi && exec node dist/server.js"]
