# Connexion et dossiers privés — Portfolio Studio

Cette version affiche la page de connexion **Cloudflare Access** avant l'application. Après identification, chaque compte ne peut lire ou modifier que ses clients et stratégies. Les API vérifient la signature, l'émetteur et l'audience du jeton Access, puis utilisent son identifiant `sub` pour cloisonner les données.

## Ordre de mise en service

1. **Tout de suite :** Cloudflare → Workers & Pages → `portfolio-studio` → Settings → Domains & Routes → `workers.dev` → **Enable Cloudflare Access**. Protéger aussi les Preview URLs si elles sont actives. Dans **Manage Cloudflare Access**, configurer une règle *Allow* limitée aux adresses e-mail autorisées ; ne pas choisir « Everyone ». Vérifier en navigation privée que le site demande la connexion. Cette étape coupe l'accès public pendant la migration.
2. Dans Cloudflare Zero Trust → Access controls → Applications → l'application du Worker, relever **Application Audience (AUD) Tag** et votre **team domain** (`https://VOTRE-EQUIPE.cloudflareaccess.com`). Sous Workers & Pages → `portfolio-studio` → Settings → Environment Variables, ajouter `POLICY_AUD` et `TEAM_DOMAIN` avec ces valeurs. Ne pas mettre ces valeurs dans un fichier `.env` publié ni dans un exemple de commande partagé.
3. Sur Windows, ouvrir PowerShell dans le dossier décompressé, puis sauvegarder la base avant toute migration :

   ```powershell
   npx wrangler d1 export portfolio-studio-db --remote --output=portfolio-studio-sauvegarde.sql
   ```

   Conserver le fichier de sauvegarde **hors du dépôt Git** : il contient les données clients. Le `.gitignore` de ce projet ignore ce nom de sauvegarde.

4. Vérifier dans Cloudflare D1 que l'identifiant de `portfolio-studio-db` est `67f9868c-1558-4bd3-acc6-20a3efee0d32`. C'est la valeur dans `vite.config.ts`. Si votre base réelle a un autre identifiant, remplacer cette valeur **avant** de publier. Ne pas rajouter de second binding `DB` dans `wrangler.jsonc` : la compilation génère déjà exactement un binding.
5. **Une seule fois**, appliquer le SQL à la base distante existante :

   ```powershell
   npx wrangler d1 execute portfolio-studio-db --remote --file=./migrations/owner-isolation.sql
   ```

   Il ajoute des colonnes et index sans supprimer les anciennes données. Ne pas rejouer le fichier : SQLite refusera des colonnes déjà présentes.
6. Publier ce code sur la branche `main` de GitHub. La configuration Cloudflare existante doit exécuter `pnpm build`, puis `npx wrangler deploy`. La compilation produit `dist/server/wrangler.json` avec **un seul** binding `DB`. `keep_vars` conserve `POLICY_AUD` et `TEAM_DOMAIN` définis dans le tableau de bord pendant les déploiements ultérieurs.
7. Avec **deux adresses e-mail distinctes** autorisées dans Access, ouvrir deux sessions privées : A crée un client ; B ne doit pas le voir. À l'inverse, B crée un client ; A ne doit pas le voir. Une session non connectée doit voir la connexion Access. Si le site affiche « connexion non configurée » ou « dossiers indisponibles », vérifier variables, binding et migration avant d'y saisir de vraies données.

## Anciens dossiers

Les clients et stratégies créés avant cette version avaient été enregistrés **sans propriétaire**. Ils restent dans D1 avec `owner_id = NULL`, donc **aucun compte ne peut les voir** après la mise à jour. Ils ne sont pas supprimés. N'attribuez pas tous les dossiers au premier compte qui se connecte : il faut décider dossier par dossier du propriétaire légitime, puis attribuer aussi ses stratégies. Faites-le uniquement après sauvegarde et vérification de l'identité des comptes concernés.

**Important :** ce cloisonnement protège les accès par l'application, pas les personnes ayant des droits administrateur Cloudflare/D1. N'utilisez des informations financières personnelles réelles qu'après validation de la connexion, des politiques Access et du test à deux comptes.
