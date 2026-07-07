# Image de production pour l'app Gestion (Next.js + SQLite)
FROM node:22-slim AS base
WORKDIR /app

# Dépendances — on installe AUSSI les devDependencies (Tailwind, TypeScript…)
# car elles sont nécessaires pour construire l'app. (better-sqlite3 : prebuilds)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Build de production
COPY . .
RUN npm run build

# Environnement d'exécution
ENV NODE_ENV=production
ENV DB_PATH=/app/data/gestion.db
ENV PORT=3000
RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000
# next start écoute sur $PORT (fourni par Render) et sur 0.0.0.0
CMD ["npm", "run", "start"]
