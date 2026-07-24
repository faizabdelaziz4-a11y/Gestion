# Gestion — Dépenses, paie & bénéfice net

Application web pour commerçants (Belgique) permettant de piloter au jour le jour
**le chiffre d'affaires, les charges, la paie des travailleurs et le bénéfice net**,
avec une vue **journalière, hebdomadaire et mensuelle**.

> Les commerçants peuvent voir d'un coup d'œil s'ils sont en bénéfice ou en perte.

**Stack** : Next.js · **PostgreSQL (Supabase)** · **Netlify**. Déploiement détaillé
dans [`DEPLOY.md`](./DEPLOY.md). Connexion propriétaire avec le mot de passe `admin`
(à changer dans *Réglages*).

## Fonctionnalités

- **Multi-commerce** : gérez plusieurs commerces dans une seule application.
  Sélecteur en haut de l'app ; chaque **onglet du navigateur** peut afficher un
  commerce différent simultanément (mémorisé par onglet). Données entièrement
  isolées entre commerces.
- **Heures d'ouverture** : heure d'ouverture / fermeture par commerce.
- **Imports & intégrations** : importez un export CSV/JSON de votre caisse / POS /
  comptable (mappage des colonnes auto-détecté) ; ou laissez votre **caisse
  automatique pousser le flux** (CA, cash) en temps réel via un **endpoint
  d'ingestion à jeton** (`POST /api/ingest/<jeton>`). Tout alimente le tableau de bord.
- **Tableau de bord** : indicateur bénéfice / perte, CA, marge commerciale, coûts,
  graphique du bénéfice par jour, détail journalier — en vues **jour / semaine / mois**.
- **Travailleurs** : ajout / retrait, poste, statut, salaire **modifiable**.
  - On saisit le **net** que l'on paye, l'app calcule le **brut** et le
    **coût total employeur** selon la **législation belge** et le **statut**
    (employé/ouvrier, étudiant, flexi-job, indépendant).
  - **Suppléments financiers** (primes) datés.
  - **Code d'accès** par travailleur pour l'espace à accès limité.
- **Horaires & kilométrage** : saisie manuelle ou **import par photo**.
  - Pour les **livreurs** : km début / fin de journée → **coût diesel** calculé sur
    **6,4 L/100 km** au **prix du diesel du jour**, récupéré **automatiquement** au
    prix officiel belge (Statbel / SPF Économie, Diesel B7 TVA incl.) ou saisi à la main.
- **Espace travailleur (accès limité)** : pointer début / fin et **prendre en photo
  le tableau de bord** pour le kilométrage (lecture automatique si IA activée).
- **Charges** : fixes et variables (électricité, comptable, loyer, assurance,
  marchandises…), réparties automatiquement **par jour**.
- **CA & marge** : saisie quotidienne du chiffre d'affaires et du % de marge →
  marge commerciale → **indicateur de bénéfice ou de perte**.
- **Commission plateforme** : part du CA passée par une plateforme de livraison
  (Uber Eats, Deliveroo, Takeaway…) et son taux de **commission (17 % par défaut)**,
  déduit automatiquement comme coût dans le bénéfice net.
- **Contrôle de caisse** : fond de caisse en début et cash compté en fin de soirée
  → **écart de caisse** (surplus / manquant) pour vérifier que le cash est correct.
- **Assistant IA** (optionnel) : lecture du compteur kilométrique et import
  d'horaire depuis une photo via l'API Claude.

## Démarrage

```bash
npm install
npm run seed     # (optionnel) données de démonstration
npm run dev      # http://localhost:3000
```

Production :

```bash
npm run build && npm run start
```

### Connexion

- **Propriétaire** : mot de passe par défaut `admin` (à changer dans *Réglages*).
- **Travailleur** : code d'accès affiché sur sa fiche (onglet *Travailleurs*).

### Développer en local

Il faut un **PostgreSQL** (local ou Supabase). Voir [`DEPLOY.md`](./DEPLOY.md).

```bash
export DATABASE_URL="postgres://user@localhost:5432/gestion"
npm install
npm run seed   # données de démo (2 commerces)
npm run dev    # http://localhost:3000
```

Le schéma des tables se crée automatiquement au premier accès.

### En ligne

Déploiement **Netlify + Supabase** — guide pas à pas dans [`DEPLOY.md`](./DEPLOY.md).

## Configuration

| Variable d'env.         | Rôle                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`          | Connexion PostgreSQL / Supabase (pooler). **Requis.**                    |
| `SUPABASE_URL`          | URL du projet Supabase (stockage des photos).                            |
| `SUPABASE_SERVICE_KEY`  | Clé `service_role` Supabase (stockage des photos).                       |
| `SESSION_SECRET`        | Secret de signature des sessions.                                        |
| `ANTHROPIC_API_KEY`     | Active la lecture IA des photos (compteur km, planning). Optionnel.      |

Sans `ANTHROPIC_API_KEY`, l'app reste **100 % fonctionnelle** : la lecture des
photos bascule en **saisie manuelle**.

Les paramètres métier (consommation diesel, prix par défaut, **taux ONSS
travailleur / patronal / solidarité étudiant**) sont modifiables dans *Réglages*.

## Calcul de la paie (Belgique) — estimation

Le sens « employeur » part du **net versé** et remonte au **brut** puis au
**coût total** :

- **Employé / ouvrier** : ONSS travailleur 13,07 % → imposable → précompte
  professionnel (barème progressif simplifié) → net. Coût employeur = brut +
  ONSS patronal (~25 %).
- **Étudiant** : cotisation de solidarité ~2,71 %, pas de précompte.
- **Flexi-job** : net = brut (exonéré), cotisation patronale spéciale.
- **Indépendant** : montant facturé = coût (pas de cotisation).

⚠️ **Estimation.** La paie belge réelle dépend de la situation familiale, des
réductions (bonus à l'emploi, frais forfaitaires), des barèmes officiels de
précompte, des commissions paritaires sectorielles, etc. Les taux sont
paramétrables. Pour un décompte officiel, référez-vous à votre secrétariat social.

## Architecture

```
lib/
  db.ts        Base PostgreSQL (Supabase) — schéma auto + helpers
  payroll.ts   Paie belge net↔brut↔coût employeur (+ tests)
  diesel.ts    Coût diesel (6,4 L/100 km × prix du jour)
  time.ts      Heures, semaines ISO, agrégations
  finance.ts   Agrégation P&L jour/semaine/mois
  ocr.ts       Lecture IA des photos (Claude Vision) ou repli manuel
  auth.ts      Sessions propriétaire / travailleur
app/
  (app)/       Espace propriétaire (tableau de bord, travailleurs, horaires,
               charges, CA, réglages)
  espace/      Espace travailleur à accès limité (pointage + photo km)
  api/         Routes REST
```

### Répartition des coûts dans le P&L

- Le **coût main d'œuvre** d'un mois est réparti sur les jours travaillés du mois
  au prorata des heures. Tant qu'un seul jour est saisi pour un salarié mensuel,
  l'intégralité de son coût mensuel apparaît sur ce jour ; le coût se **lisse**
  à mesure que le mois se remplit.
- Les **charges** sont converties en montant journalier selon leur fréquence
  (mensuel → /jours du mois, annuel → /365, etc.).

## Tests

```bash
npm test   # logique de paie (net↔brut, statuts, coût employeur)
```

## Limites connues / pistes

- Estimation de paie (voir ci-dessus) — brancher un calcul officiel si besoin.
- Prix diesel : récupération automatique du prix officiel (bouton dans *Réglages*,
  source Statbel/SPF Économie paramétrable), avec repli en saisie manuelle / valeur
  par défaut si la source est injoignable.
- Authentification simple par mot de passe / code — suffisante pour un usage
  commerce ; renforcer (utilisateurs multiples, 2FA) pour un déploiement large.
