# Image de production (option conteneur / VPS). Nécessite DATABASE_URL (Postgres)
# et, pour les photos, SUPABASE_URL + SUPABASE_SERVICE_KEY. Voir DEPLOY.md.
FROM node:22-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
