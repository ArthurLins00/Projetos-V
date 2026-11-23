# Serviço HTTP do Assistente Fiscalize (npm run serve). Guia: docs/COMO_RODAR_COM_DOCKER.md
FROM node:22-bookworm-slim

WORKDIR /app

# tsx (dependência de desenvolvimento) executa o TypeScript direto, sem etapa de build
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Sem root: o agente só lê o próprio código e grava apenas o log de uso dos dados (logs/)
RUN mkdir -p logs && chown node:node logs
USER node

# Dentro do container o serviço escuta em todas as interfaces; o compose não publica a porta no host,
# então ele só é alcançável pela rede interna (pelo backend)
ENV AI_AGENT_HOST=0.0.0.0 \
    AI_AGENT_PORT=3333
EXPOSE 3333

CMD ["npm", "run", "serve"]
