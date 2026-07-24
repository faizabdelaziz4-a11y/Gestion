# Gestion — Dossier technique complet (contexte pour une IA)

Document de référence exhaustif : architecture, modèle de données, logique métier,
API, et déploiement. Objectif : permettre à une IA (ou un développeur) de comprendre,
maintenir, étendre ou reconstruire l'application sans contexte préalable.

---

## 1. Vue d'ensemble

**Gestion** est une application web pour **commerçants (Belgique)** qui calcule au
jour le jour le **bénéfice net** (ou la perte) à partir du chiffre d'affaires, des
charges, de la paie des travailleurs, du carburant des livreurs, des commissions de
plateformes de livraison et du contrôle de caisse. Vues **jour / semaine / mois**.

Deux rôles :
- **Propriétaire** : accès complet (tableau de bord, gestion).
- **Travailleur** : accès limité à **une seule page** de pointage (heures + photos ;
  kilométrage pour les livreurs).

L'app est **multi-commerce** : un même propriétaire gère plusieurs commerces, isolés.

---

## 2. Stack technique

- **Framework** : Next.js 15 (App Router, React 19, TypeScript). API = Route Handlers
  sous `app/api/**/route.ts` (runtime Node).
- **Base de données** : PostgreSQL (Supabase). Accès via la librairie `postgres`
  (porsager), requêtes SQL en templates balisés. Schéma créé automatiquement au
  premier accès (`ensureSchema`, idempotent, `CREATE TABLE IF NOT EXISTS`).
- **Stockage fichiers** : Supabase Storage (bucket public `uploads`) ; repli disque
  local (`public/uploads`) en développement si Supabase non configuré.
- **UI** : Tailwind CSS. Graphiques en SVG maison (pas de librairie de charts).
- **Auth** : cookie signé HMAC (maison, pas de lib externe).
- **Hébergement cible** : Netlify (`@netlify/plugin-nextjs`).
- **IA optionnelle** : API Anthropic (Claude, vision) pour lire les photos ; repli
  manuel si `ANTHROPIC_API_KEY` absent.

### Variables d'environnement
| Variable | Rôle | Requis |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL/Supabase (pooler, port 6543 en prod) | Oui |
| `SUPABASE_URL` | URL projet Supabase (stockage photos) | Prod |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` (stockage photos) | Prod |
| `SESSION_SECRET` | Secret HMAC de signature des sessions | Recommandé |
| `ANTHROPIC_API_KEY` | Active la lecture IA des photos/imports | Optionnel |

---

## 3. Modèle de données (PostgreSQL)

Référence complète : `supabase/schema.sql` et `lib/db.ts`. Les dates sont stockées
en `TEXT` au format `YYYY-MM-DD` ; les heures en `TEXT` `HH:MM`. `active` est un
entier 0/1.

- **settings**(`key` PK, `value`) — réglages globaux. Contient `owner_password` (déf. `admin`).
- **businesses**(`id` PK, `name`, `opening_time`, `closing_time`, `region`,
  `diesel_consumption` déf. 6.4, `default_diesel_price` déf. 1.75, `employer_onss_rate`
  déf. 0.25, `onss_worker_rate` déf. 0.1307, `onss_student_rate` déf. 0.0271,
  `diesel_product` déf. `'Diesel B7 (€/L)'`, `diesel_source_url` (API Statbel),
  `ingest_token` unique, `created_at`).
- **workers**(`id` PK, `business_id` FK→businesses, `name`, `poste` [vendeur|livreur|
  cuisine|caisse|gérant|autre], `statut` [employe|etudiant|flexi|independant],
  `pay_type` [hourly|monthly], `pay_basis` [net|brut], `base_rate`, `access_code`
  unique, `active`, `created_at`).
- **shifts**(`id` PK, `worker_id` FK→workers, `date`, `start_time`, `end_time`,
  `break_minutes`, `km_start`, `km_end`, `photo_path` (photo compteur), `open_photo`
  (photo local ouverture), `close_photo` (photo local fermeture), `source`
  [manuel|travailleur|photo], `note`, `created_at`).
- **supplements**(`id` PK, `worker_id` FK, `date`, `label`, `amount`) — primes.
- **charges**(`id` PK, `business_id` FK, `label`, `category`, `kind` [fixe|variable],
  `amount`, `period` [journalier|hebdomadaire|mensuel|annuel|ponctuel], `date`
  (pour ponctuel), `active`).
- **revenue**(`id` PK, `business_id` FK, `date`, `ca`, `margin_pct`, `platform_ca`,
  `platform_rate` déf. 0.17, `source` [manuel|import|api], `note`,
  UNIQUE(`business_id`,`date`)) — un enregistrement CA par jour et par commerce.
- **diesel_prices**(`date` PK, `price`) — **global** (prix officiel national), non
  scopé par commerce.
- **cash**(`business_id` FK, `date`, `opening`, `expected_cash`, `closing`, `source`,
  `note`, PK(`business_id`,`date`)) — contrôle de caisse.

`shifts` et `supplements` sont rattachés à un commerce **via** `worker_id → workers.business_id`.

---

## 4. Multi-commerce (isolation)

- Le commerce actif est choisi **côté client** et mémorisé **par onglet** du
  navigateur dans `sessionStorage` (clé `activeBusinessId`). Le helper client `api()`
  (`app/components/api.ts`) ajoute l'en-tête **`x-business-id`** à chaque requête.
- Côté serveur, `getActiveBusinessId()` (`lib/business.ts`) lit cet en-tête, le valide
  (le commerce doit exister) sinon renvoie le premier commerce.
- Toutes les routes propriétaire sont scopées : `WHERE business_id = $activeId`
  (ou via jointure `workers` pour shifts/supplements). Garde d'accès :
  `requireOwnerBusiness()` (`lib/api.ts`) → renvoie l'objet `Business` complet.
- Deux onglets peuvent afficher deux commerces différents simultanément.

---

## 5. Authentification (`lib/auth.ts`)

- Cookie `gestion_session` = `base64url(JSON(session)) + "." + HMAC_SHA256(payload, SESSION_SECRET)`.
  Session = `{role:'owner'}` ou `{role:'worker', workerId, name}`.
- **Propriétaire** : `POST /api/auth/login {password}` comparé à `settings.owner_password`.
- **Travailleur** : `POST /api/auth/login {code}` → recherche `workers.access_code`
  (actif). Session worker → redirigé vers `/espace`.
- Gardes serveur : `requireOwner`, `requireOwnerBusiness`, `requireAuth`
  (`lib/api.ts`). Les routes propriétaire renvoient **401** à un travailleur.

---

## 6. Logique métier

### 6.1 Paie belge — `lib/payroll.ts` (ESTIMATION paramétrable)
Sens « employeur » : on saisit un **net** (ou brut) et on obtient brut + coût employeur.

Taux par commerce : `onss_worker_rate` (0.1307), `onss_student_rate` (0.0271),
`employer_onss_rate` (0.25).

Barème d'impôt (sur revenu **imposable annuel**, quotité exemptée `TAX_FREE = 10160`) :
25 % jusqu'à 15 820 ; 40 % jusqu'à 27 920 ; 45 % jusqu'à 48 320 ; 50 % au-delà.
Précompte mensuel = `annualTax(imposableMensuel × 12) / 12`.

Calcul `fromGross(brut, statut)` :
- **employe** : `onssWorker = brut×0.1307` ; `imposable = brut − onssWorker` ;
  `precompte = withholding(imposable)` ; `net = imposable − precompte` ;
  `employerOnss = brut×0.25` ; `employerCost = brut + employerOnss`.
- **etudiant** : `onssWorker = brut×0.0271` ; `precompte = 0` ; `net = brut − onssWorker` ;
  `employerOnss = brut×0.0542` (solidarité patronale).
- **flexi** : `net = brut` (exonéré) ; `employerOnss = brut×employer_onss_rate`.
- **independant** : `net = brut = employerCost` (aucune cotisation ; montant facturé).

`fromNet(net, statut)` : dichotomie sur `fromGross` (net croissant avec le brut).

### 6.2 Diesel — `lib/diesel.ts` + `lib/dieselSource.ts`
- `liters = km × consommation / 100` (consommation par commerce, déf. 6,4 L/100 km).
- `coût = liters × prixLitre`. Prix : `diesel_prices` à la date exacte, sinon le plus
  récent ≤ date, sinon `default_diesel_price` du commerce.
- **Prix officiel** : `fetchOfficialDieselPrice()` interroge l'API Statbel (be.STAT),
  vue `9e9cf394-6c54-4d81-8013-7124a8c4bf15`, produit `Diesel B7 (€/L)`, champ
  `Prix TVA incl.`. Date renvoyée au format `DDMMMYY` (ex. `29JUN26`) → convertie ISO.
  Déclenché par `POST /api/diesel-prices/fetch`, stocké dans `diesel_prices`.

### 6.3 Agrégation financière — `lib/finance.ts`
`summary(businessId, period, date)` → `{ totals, days[] }`. Pour chaque jour
(`dayBreakdown`) :
- `grossMargin = ca × margin_pct / 100`.
- `platformFee = platform_ca × platform_rate` (commission plateforme livraison, déf. 17 %).
- **Main d'œuvre** : pour chaque travailleur actif ayant des shifts ce jour :
  contexte mensuel = `compute(montant, statut, basis)` où `montant` = `base_rate`
  (mensuel) ou `heuresDuMois × base_rate` (horaire) ; `employerCost` réparti au prorata
  `heuresDuJour / heuresDuMois`. (Conséquence : le coût mensuel d'un salarié se lisse
  sur ses jours travaillés ; un seul jour saisi = tout le coût du mois ce jour-là.)
- **Diesel** : somme sur les shifts livreurs du jour ayant `km_start`/`km_end`.
- **Charges** : part journalière selon `period` (journalier=montant ; hebdomadaire/7 ;
  mensuel/joursDuMois ; annuel/joursDeLAnnée ; ponctuel=montant si `date` == jour).
- **Suppléments** : somme des primes du jour.
- `totalCosts = labor + diesel + chargesFixes + chargesVariables + supplements + platformFee`.
- `netProfit = grossMargin − totalCosts`.
- **Jour futur** (`date > aujourd'hui`) → tout à zéro (pas de perte projetée).

### 6.4 Contrôle de caisse
`recette = closing − opening` ; `ecart = recette − expected_cash`
(positif = surplus, négatif = manquant).

### 6.5 Imports & ingestion — `lib/import.ts`
- Import fichier : `POST /api/import` (multipart CSV/JSON) → parse (détection
  séparateur `,`/`;`/tab, décimales FR), propose un **mappage** de colonnes
  (date, ca, margin_pct, platform_ca, cash_closing, cash_opening) par heuristique.
  `POST /api/import/commit` écrit dans `revenue`/`cash` (source `import`), upsert par
  `(business_id, date)`.
- Ingestion temps réel : `POST /api/ingest/<token>` (public, authentifié par le
  `ingest_token` du commerce, sans session). Corps :
  `{date, ca?, margin_pct?, platform_ca?, cash_opening?, cash_closing?, cash_expected?}`.
  Écrit dans `revenue`/`cash` (source `api`). Jeton invalide → 401.

### 6.6 IA / OCR — `lib/ocr.ts`
Si `ANTHROPIC_API_KEY` : lecture du compteur (`readDashboardKm`) et d'un planning
(`readSchedule`) via Claude vision. Sinon repli manuel. Upload photo simple :
`POST /api/ocr` avec `kind=photo` (enregistre sans lecture).

---

## 7. API (routes principales, toutes sous `/api`)

Sauf mention, réservé au propriétaire et scopé au commerce actif (`x-business-id`).

| Méthode & route | Rôle |
|---|---|
| `POST /auth/login` | Connexion `{password}` (proprio) ou `{code}` (travailleur) |
| `POST /auth/logout`, `GET /auth/me` | Session |
| `GET/POST /businesses`, `PATCH/DELETE /businesses/[id]` | Commerces (config, heures, jeton) |
| `GET/POST /workers`, `PATCH/DELETE /workers/[id]` | Travailleurs |
| `GET/POST /shifts`, `PATCH/DELETE /shifts/[id]` | Horaires/km (heures & diesel calculés) |
| `GET/POST/DELETE /supplements` | Primes |
| `GET/POST /charges`, `PATCH/DELETE /charges/[id]` | Charges |
| `GET/POST /revenue` | CA + marge + plateforme (upsert par date) |
| `GET/POST /cash` | Contrôle de caisse (écart calculé) |
| `GET /summary?period=&date=` | Agrégation P&L jour/semaine/mois |
| `GET /payroll?amount=&statut=&basis=` | Simulateur paie |
| `GET/POST /diesel-prices`, `POST /diesel-prices/fetch` | Prix diesel (global) + récupération officielle |
| `POST /import`, `POST /import/commit` | Import fichier (aperçu + validation) |
| `POST /ingest/[token]` | **Public** : ingestion caisse auto (jeton) |
| `GET/POST /worker/clock` | **Travailleur** : pointage (heures, km, photos) |
| `POST /ocr` | Upload/lecture photo (proprio ou travailleur) |
| `GET/POST /settings` | Global : mot de passe, statut IA |

---

## 8. Structure du code

```
app/
  (app)/                 Espace propriétaire (garde owner via layout)
    page.tsx             Tableau de bord (KPIs + graphiques SVG)
    revenus, caisse, travailleurs, horaires, charges, imports, reglages/
    layout.tsx           Garde owner + <Shell> (nav + sélecteur commerce)
  espace/                Espace travailleur (page unique verrouillée)
    page.tsx (garde), EspaceClient.tsx
  login/page.tsx         Connexion (2 panneaux)
  api/**/route.ts        Routes API (voir §7)
  components/
    api.ts               fetch + en-tête x-business-id (sessionStorage)
    BusinessContext.tsx  Provider commerce actif (par onglet)
    Shell.tsx            Navigation + sélecteur de commerce
    Charts.tsx           ProfitChart, CostBar (SVG)
lib/
  db.ts                  Client Postgres + ensureSchema + helpers
  business.ts            Résolution commerce actif (en-tête)
  auth.ts                Sessions (cookie HMAC)
  api.ts                 Gardes + helpers réponse
  payroll.ts             Paie belge (+ payroll.test.ts)
  diesel.ts, dieselSource.ts   Coût diesel + prix officiel Statbel
  finance.ts             Agrégation P&L
  import.ts              Parsing/mappage imports
  ocr.ts                 IA vision (optionnelle)
  upload.ts              Stockage Supabase / disque
  time.ts                Heures, semaines ISO, plages de dates
scripts/seed.ts          Données de démonstration (2 commerces)
supabase/schema.sql      Schéma de référence
netlify.toml, Dockerfile Déploiement
```

---

## 9. Déploiement (voir `DEPLOY.md`)

Netlify (import du dépôt GitHub, `@netlify/plugin-nextjs`) + Supabase (Postgres via
`DATABASE_URL` pooler port 6543, bucket public `uploads`, clés API). Variables d'env :
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SESSION_SECRET`,
`ANTHROPIC_API_KEY` (optionnel). Connexion propriétaire par défaut : `admin`.

---

## 10. Limites & pistes connues

- **Paie = estimation** : barèmes simplifiés (pas de situation familiale, bonus à
  l'emploi, frais réels, CP sectorielles). Taux ajustables par commerce.
- **Sécurité** : auth simple (mot de passe unique + codes). Pour un usage large :
  utilisateurs multiples, 2FA, RLS Supabase.
- **Répartition M.O.** : lissage mensuel (voir §6.3) — cohérent sur un mois complet.
- **Prix diesel** : national (Statbel) ; la région du commerce est indicative.
- **IA** : dépend de `ANTHROPIC_API_KEY` ; sinon saisie manuelle partout.
