FROM node:24.14.1-slim

WORKDIR /app

# Copia apenas os arquivos de manifesto e instala dependências de produção
COPY --chown=node:node package*.json ./
RUN npm ci --only=production

# Copia o restante do código e define o usuário não-root por segurança
COPY --chown=node:node . .
USER node

EXPOSE 3000
CMD ["node", "server.js"]
