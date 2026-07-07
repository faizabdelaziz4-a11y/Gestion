# Mettre l'application en ligne — Netlify + Supabase

L'app utilise **Next.js** (hébergé sur **Netlify**), **PostgreSQL** (base de données
**Supabase**) et **Supabase Storage** (photos). Voici la marche à suivre.

## 1) Créer la base de données Supabase (~3 min)

1. Va sur https://supabase.com → **New project** (choisis un mot de passe de base
   de données, garde-le).
2. Quand le projet est prêt : **Project Settings → Database → Connection string →
   « Transaction » (pooler, port 6543)**. Copie l'URL (elle ressemble à
   `postgresql://postgres.xxxx:MOTDEPASSE@aws-...pooler.supabase.com:6543/postgres`).
   → ce sera `DATABASE_URL`.
3. **Project Settings → API** : copie l'**URL du projet** (`SUPABASE_URL`) et la clé
   **`service_role`** (`SUPABASE_SERVICE_KEY`).
4. **Storage → New bucket** → nom `uploads` → coche **Public bucket** → Create.

> Le schéma des tables se crée **automatiquement** au premier lancement de l'app
> (aucune commande SQL à lancer). Un script de référence existe dans
> [`supabase/schema.sql`](./supabase/schema.sql) si tu veux le faire à la main.

## 2) Déployer sur Netlify (~3 min)

1. Va sur https://app.netlify.com → **Add new site → Import an existing project**.
2. **Deploy with GitHub** → autorise → choisis le dépôt **`Gestion`**.
3. Netlify détecte Next.js automatiquement (via `netlify.toml`). Laisse les réglages
   par défaut.
4. **Avant de déployer**, ouvre **Site configuration → Environment variables** et
   ajoute :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | la connexion pooler Supabase (étape 1.2) |
   | `SUPABASE_URL` | l'URL du projet Supabase |
   | `SUPABASE_SERVICE_KEY` | la clé `service_role` |
   | `SESSION_SECRET` | une longue chaîne aléatoire (invente-la) |
   | `ANTHROPIC_API_KEY` | *(optionnel)* active la lecture IA des photos/imports |

5. Clique **Deploy**. En quelques minutes tu obtiens une URL
   `https://<ton-site>.netlify.app`.
6. Ouvre l'URL → connexion **Propriétaire**, mot de passe **`admin`**
   (change-le dans *Réglages*).

## 3) (Optionnel) Données de démonstration

En local, avec la même `DATABASE_URL` :

```bash
DATABASE_URL="postgresql://…pooler.supabase.com:6543/postgres" npm run seed
```

## Développer en local

Sans Supabase, tu peux pointer sur un PostgreSQL local :

```bash
export DATABASE_URL="postgres://user@localhost:5432/gestion"
npm install
npm run seed   # données de démo
npm run dev    # http://localhost:3000
```

Sans `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, les photos sont stockées sur le disque
local (dossier `public/uploads`) — pratique en dev, mais en production sur Netlify
il **faut** Supabase Storage (le disque n'y est pas persistant).

## Brancher la caisse automatique (POS)

Dans *Réglages*, copie le **jeton d'ingestion** du commerce, puis pousse le flux :

```bash
curl -X POST https://<ton-site>.netlify.app/api/ingest/<jeton> \
  -H 'content-type: application/json' \
  -d '{"date":"2026-07-02","ca":1200,"margin_pct":38,"cash_closing":650,"cash_opening":150}'
```
