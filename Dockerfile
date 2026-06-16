# Espaço Flow — imagem de produção (Next.js 15 + Drizzle + Postgres)
# Build e runtime numa imagem só (simples e confiável para EasyPanel).
FROM node:20-alpine

WORKDIR /app

# Dependências (todas — o build precisa das devDeps; drizzle-kit roda as migrações no start).
# Usa "npm install" (não "npm ci") porque o lockfile é gerado no Windows e não traz
# os binários opcionais nativos do Linux (@emnapi/sharp) exigidos na imagem alpine.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Código-fonte + build de produção
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# No start: aplica as migrações (idempotente) e sobe o servidor.
# O worker da fila usa a MESMA imagem, com Start Command: npm run worker
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
