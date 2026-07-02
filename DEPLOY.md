# Mettre la démo en ligne

L'app est prête à être déployée. Choisissez l'option la plus simple pour vous.

## Option A — Render (recommandé, gratuit, persistant)

1. Le code est déjà sur GitHub (branche `claude/expense-profit-management-app-waqd7g`).
2. Créez un compte sur https://render.com (gratuit).
3. **New → Blueprint**, sélectionnez ce dépôt. Render lit `render.yaml`,
   construit le `Dockerfile` et déploie automatiquement.
4. Au bout de quelques minutes, vous obtenez une URL publique
   `https://gestion-xxxx.onrender.com`.
5. Connexion propriétaire : mot de passe **`admin`** (changez-le dans *Réglages*).

Le disque monté sur `/app/data` conserve la base SQLite entre les redémarrages.
Pour activer l'IA (lecture photo / mappage import), ajoutez la variable
`ANTHROPIC_API_KEY` dans les réglages du service Render.

## Option B — Docker (n'importe quel serveur / VPS)

```bash
docker build -t gestion .
docker run -d -p 3000:3000 \
  -e SESSION_SECRET="un-secret-long" \
  -v gestion-data:/app/data \
  -v gestion-uploads:/app/public/uploads \
  --name gestion gestion
```
Accès : http://VOTRE-SERVEUR:3000

## Option C — En local (pour développer / améliorer)

```bash
npm install
npm run seed   # données de démo (2 commerces) — optionnel
npm run dev    # http://localhost:3000
```

## Brancher la caisse automatique (POS)

Dans *Réglages*, copiez le **jeton d'ingestion** du commerce, puis poussez le
flux quotidien (depuis la caisse, un script, Zapier/Make, etc.) :

```bash
curl -X POST https://VOTRE-URL/api/ingest/<jeton> \
  -H 'content-type: application/json' \
  -d '{"date":"2026-06-28","ca":1200,"margin_pct":38,"cash_closing":650,"cash_opening":150}'
```

> Notes : Vercel n'est pas adapté ici (SQLite a besoin d'un disque persistant ;
> le système de fichiers serverless est éphémère). Préférez Render, Railway,
> Fly.io ou un VPS.
