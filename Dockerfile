# Image de production pour l'app Gestion (Next.js + SQLite)
FROM node:22-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# Dépendances (better-sqlite3 utilise des prebuilds, pas de toolchain requise)
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Données persistantes (montez un volume sur /app/data en production)
ENV DB_PATH=/app/data/gestion.db
RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000
CMD ["npm", "run", "start"]
