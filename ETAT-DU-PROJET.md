# État du projet — à lire à chaque reprise

_Dernière mise à jour : migration PostgreSQL/Supabase + préparation Netlify._

## En une phrase
L'application est **construite, testée et fonctionnelle**. Il reste **une seule
étape**, à faire par toi : la **mettre en ligne** sur Netlify + Supabase.

## ✅ FAIT (côté développement — rien à refaire)
- Application complète : tableau de bord bénéfice/perte (jour/semaine/mois),
  paie belge (net→brut→coût), multi-commerce + heures d'ouverture, diesel officiel,
  contrôle de caisse, commission plateforme (17 %), imports CSV/JSON + ingestion API.
- Espace travailleur **verrouillé** : pointage début/fin + photo du local, km
  (photo compteur) pour les livreurs uniquement.
- Design pro (tableau de bord, graphiques, page de connexion).
- **Migration vers PostgreSQL (Supabase)** + **stockage photos Supabase** + config
  **Netlify** — vérifié de bout en bout. Tests 7/7, build OK.
- Code sur GitHub : branche `main` (version app) + **PR #2** (migration Supabase/Netlify) :
  https://github.com/faizabdelaziz4-a11y/Gestion/pull/2

## ⏳ À FAIRE (par toi, ~6 min) — voir `DEPLOY.md` pour le détail
1. **Fusionner la PR #2** dans `main` (un clic « Merge » sur GitHub).
2. **Supabase** : créer un projet → récupérer `DATABASE_URL` (Connection string
   « Transaction », port 6543) + `Project URL` + clé `service_role` → créer un
   bucket **public** nommé `uploads`.
3. **Netlify** : Importer le dépôt `Gestion` → ajouter les variables d'env
   (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`) →
   **Deploy**.
4. Ouvrir l'URL `https://…netlify.app` → connexion **`admin`** (à changer dans Réglages).

## 🔑 À savoir
- Mot de passe propriétaire par défaut : **`admin`**.
- Chaque travailleur a un **code d'accès** (visible dans l'onglet Travailleurs).
- Comptes nécessaires : **GitHub** (ok), **Supabase** + **Netlify** (les tiens).

## 🧭 Où en reprendre avec l'assistant
Dis simplement « **on en est où ?** » ou « reprends le déploiement », et pointe
l'étape À FAIRE où tu bloques (avec une capture d'écran si possible).
