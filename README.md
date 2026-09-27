# Azur Portfolio Studio

Application de gestion et d’optimisation de portefeuilles selon Markowitz.

## Fonctionnalités

- espaces clients et allocation initiale ;
- optimisation sous contrainte de rendement, volatilité, poids maximal et frais ;
- frontière efficiente et nuage de portefeuilles ;
- comparaison et sauvegarde de stratégies ;
- import d’un univers d’actifs avec rendements espérés et covariance ;
- stockage durable avec Cloudflare D1.

## Prérequis

- Node.js 22.13 ou version supérieure ;
- Git ;
- pnpm, activable avec `corepack enable`.

## Installation locale

```bash
corepack enable
pnpm install
pnpm run db:generate
pnpm run build
pnpm dev
```

L’application est alors disponible sur l’adresse locale affichée par le terminal.

Pour appliquer la migration D1 au stockage local après le build :

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_lumpy_mojo.sql
```

## Publier sur GitLab

Après extraction du projet :

```bash
git init
git add .
git commit -m "Initial commit: Azur Portfolio Studio"
git branch -M main
git remote add origin https://gitlab.com/UTILISATEUR/NOM-DU-DEPOT.git
git push -u origin main
```

Remplace l’URL par celle de ton dépôt GitLab.

Les dossiers `node_modules`, `dist`, `.wrangler` et `.sites-runtime` ne sont pas nécessaires dans Git et sont ignorés.

## Modèle mathématique

Pour des poids \(w\), un vecteur de rendements espérés \(\mu\) et une covariance \(\Sigma\) :

$$
E[R_p] = \mu^\top w, \qquad
\sigma_p = \sqrt{w^\top\Sigma w}.
$$

Les frais de réallocation sont calculés par :

$$
\text{frais} = cW\sum_i |w_i-w_i^{(0)}|,
$$

où \(c\) est le taux de transaction, \(W\) la fortune et \(w^{(0)}\) l’allocation initiale.
