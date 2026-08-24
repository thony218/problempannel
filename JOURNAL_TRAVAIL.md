# Journal de travail

> Propriétaire courant : voir dernière entrée.
> But : permettre à n'importe quel prochain worker (humain ou agent) de reprendre exactement où le précédent s'est arrêté, sans relire toute la conversation qui a précédé.

## Comment utiliser ce journal

- **Avant de commencer** : lis la dernière entrée (en bas du fichier, ordre chronologique). Elle indique le "Prochain propriétaire" et les tâches suivantes suggérées.
- **Une entrée par tâche terminée** (ou par lot cohérent de tâches liées), au moment du commit correspondant.
- **Ne jamais** remplacer ou réécrire une entrée passée. Corriger une erreur = nouvelle entrée qui l'annule/la précise, jamais une réécriture silencieuse (cf. `G-007` historique append-only, même esprit appliqué ici).
- Champs obligatoires par entrée, calqués sur `05_qualite_exploitation/06_MODELE_HANDOFF.md` :
  1. Task IDs (référence `03_execution/06_BACKLOG_V1_ATOMIQUE.md`)
  2. Date
  3. Owner
  4. Commit(s)
  5. Fichiers produits/modifiés
  6. Commandes exécutées + résultat
  7. `npm run verify` : PASS/FAIL (coller le résumé si FAIL)
  8. Staging testé : oui/non
  9. Limitations connues / dette
  10. RFC ouverte : oui/non (lien si oui)
  11. Prochain propriétaire + tâches suivantes suggérées

Un simple « fini » n'est pas une entrée valide (cf. `03_execution/02_HANDOFFS.md`).

---

## État global

| Vague | Statut |
|---|---|
| Bootstrap 0 | PRESQUE TERMINÉ — il ne reste que "CI verte" (bloqué : aucun remote Git configuré) |
| Vague A — Fondations | EN COURS (FND-* + AUTH-01..05 + META-01 faits ; META-02 UI et ISSUE-01+ restent) |
| Vague B — Tranches verticales | NON DÉMARRÉE |
| Vague C | NON DÉMARRÉE |
| Vague D | NON DÉMARRÉE |

---

## Entrées

### 2026-08-24 — Bootstrap 0 : init dépôt

- **Task IDs** : FND-01 (Initialiser dépôt selon arborescence)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent)
- **Commit(s)** : (à venir dans ce commit — voir message de commit associé)
- **Fichiers produits/modifiés** : `.git/` initialisé sur `main`; ajout de `JOURNAL_TRAVAIL.md` (ce fichier).
- **Commandes exécutées** :
  - `git init -b main` → OK
  - `git config user.email/user.name` (identité locale au dépôt, aucune config globale trouvée)
- **`npm run verify`** : pas encore exécuté (dépendances pas installées)
- **Staging testé** : non
- **Limitations connues** : aucun remote Git configuré (pas d'URL fournie par l'utilisateur). Tout reste local pour l'instant.
- **RFC ouverte** : non
- **Prochain propriétaire** : Intégrateur (agent), suite immédiate = FND-02 (npm install + lockfile) dans ce même passage.

---

### 2026-08-24 — Bootstrap 0 : `npm run verify` vert (FND-02 → FND-09)

- **Task IDs** : FND-02 (lockfile), FND-03 (config Vite/Worker), FND-04 (tests Worker), FND-06 (lint OpenAPI), FND-07 (types OpenAPI), FND-08 (migration D1 locale), FND-09 (seeds)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent)
- **Commit(s)** : suit celui de l'entrée précédente dans ce même passage (voir `git log`)
- **Fichiers produits/modifiés** :
  - `package.json` (versions corrigées, script `types:worker`, `verify` mis à jour)
  - `package-lock.json` (régénéré, propre, `npm ci` reproductible)
  - `contracts/openapi.yaml` (44 `summary` d'opération + réponses 4xx manquantes + descriptions de tags + `info.license`)
  - `tests/setup.ts` (correction de l'augmentation de type pour `@cloudflare/vitest-plugin` v1)
  - `tsconfig.test.json` (inclusion de `worker-configuration.d.ts` généré)
  - `.gitignore` (ajout de `worker-configuration.d.ts`, généré et non commité comme `api-types.generated.ts`)
- **Bugs réels trouvés et corrigés** (pas de contournement cosmétique — chaque point ci-dessous bloquait `npm ci` ou `npm run verify`) :
  1. **`typescript` était pinné à `7.0.2`** dans `package.json`, mais `openapi-typescript@7.13.0` (dernière version publiée) déclare `peerDependencies.typescript: "^5.x"` **et** utilise réellement l'API interne `ts.factory` du compilateur pour générer les types — API qui n'existe plus du tout dans TypeScript 7 (réécriture "Corsa"/Go, `ts.factory` est `undefined`). Ce n'était pas qu'un conflit de peer dependency déclaratif : `npm run contract:generate` plantait à l'exécution (`TypeError: Cannot read properties of undefined (reading 'createKeywordTypeNode')`). **Fix : `typescript` repointé sur `5.9.3`** (dernière 5.x, satisfait le peerDependency nativement, aucun flag npm requis).
  2. **`@cloudflare/workers-types` était pinné à `^4`**, mais `wrangler@4.125.0` (résolu par `npm install`) déclare `peerDependencies.@cloudflare/workers-types: "^5.20260820.1"`. **Fix : repointé sur `^5`** (résolu en `5.20260823.1`).
  3. **npm 12 bloque par défaut les scripts d'installation** (`esbuild`, `fsevents`, `workerd`) via son nouveau mécanisme `allowScripts`. Sans approbation, le binaire `workerd` n'est jamais téléchargé et Vite/Wrangler ne peuvent pas démarrer le runtime Workers. **Fix : `npm install-scripts approve esbuild fsevents workerd`**, ce qui écrit un bloc `allowScripts` dans `package.json` (commité, donc `npm ci` en CI aura le même comportement).
  4. **`contracts/openapi.yaml` ne passait pas `redocly lint`** (44 erreurs + 21 warnings avec le ruleset "recommended" par défaut, aucun `redocly.yaml` custom livré) : il manquait un `summary` sur chacune des 44 opérations. **Fix : ajout des 44 `summary`**, plus les réponses 4xx documentées manquantes (401/404 selon le cas), les descriptions des 10 tags et `info.license` — pour un lint propre (0 erreur, 1 seul warning restant et volontairement laissé : `/health` n'a structurellement aucun 4xx pertinent, c'est un endpoint public sans paramètre).
  5. **`tests/setup.ts` utilisait le pattern `declare module "cloudflare:test" { interface ProvidedEnv {...} }`**, qui est le pattern d'une ancienne version de `@cloudflare/vitest-plugin`. Dans la version installée (`1.0.0`), `env` est typé `Cloudflare.Env` (issu de `wrangler types`), et `ProvidedEnv` n'existe plus dans les types du package — la déclaration ne faisait donc plus rien, et `env.DB` / `env.TEST_MIGRATIONS` étaient introuvables au typecheck. **Fix : génération de `worker-configuration.d.ts` via un nouveau script `types:worker` (`wrangler types`, ajouté à `verify` avant `typecheck`), inclusion dans `tsconfig.test.json`, et remplacement de l'augmentation par `declare global { namespace Cloudflare { interface Env { TEST_MIGRATIONS: D1Migration[] } } }`** (le binding `TEST_MIGRATIONS` n'existe que côté Miniflare/tests, pas en prod — d'où l'augmentation locale au lieu de l'ajouter à `wrangler.jsonc`).
- **Commandes exécutées** (dans l'ordre, reproductibles) :
  - `npm install-scripts approve esbuild fsevents workerd`
  - `npm install` puis `rm -rf node_modules && npm ci` (vérifié identique à ce que fait la CI)
  - `npx redocly lint contracts/openapi.yaml` → 0 erreur, 1 warning (voir ci-dessus)
  - `npm run contract:generate` → OK
  - `npm run types:worker` (= `wrangler types`) → OK, génère `worker-configuration.d.ts` (non commité)
  - `npm run typecheck` (app+worker+test+e2e) → OK
  - `npm run test` (vitest, D1 via Miniflare) → 2/2 passés
  - `npm run build` → OK (Worker + client)
  - `npx wrangler d1 migrations apply DB --local` → 34 commandes exécutées, `0001_core.sql` appliqué sur un vrai D1 local (`.wrangler/state`, gitignored)
  - `npx wrangler d1 execute DB --local --file=seed/reference.sql` puis `--file=seed/dev.sql` → OK
  - Vérification des comptes : `locations=2, departments=7, categories=9, subcategories=35, impact_types=10, users=3` — conforme au contenu de `seed/reference.sql` + `seed/dev.sql`
  - `npm run verify` (from clean : fichiers générés supprimés, `dist/`+`.wrangler/` supprimés) → **exit 0**
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non (pas de compte Cloudflare/staging fourni à ce stade — hors périmètre Bootstrap 0)
- **Limitations connues / dette** :
  - Aucun remote Git configuré → impossible de faire tourner la CI GitHub Actions réelle (`V3-BOOT-02`/critère de sortie Bootstrap 0 "CI verte" reste ouvert). Dès qu'un remote est fourni : `git push` puis vérifier le run GitHub Actions.
  - `wrangler.jsonc` contient encore des `REPLACE_ME`/`REPLACE_DEV_D1_ID` (Access team domain/AUD, D1 id réel) — normal à ce stade (pas encore de ressources Cloudflare provisionnées, cf. OPS-01).
  - Le warning de lint OpenAPI restant sur `/health` (`operation-4xx-response`) est un faux positif assumé : ce endpoint est public (`security: []`), sans paramètre, donc structurellement sans 4xx métier pertinent. Pas de suppression de règle globale pour autant — seul ce point reste, documenté ici.
  - `worker/index.ts` définit encore manuellement son type `Bindings` (Hono) au lieu d'utiliser le `Env`/`Cloudflare.Env` généré par `wrangler types`. Pas touché à ce stade (hors périmètre Bootstrap 0, le code typecheckait déjà) — à corriger quand AUTH-01/META-01 démarreront pour éviter une double définition des bindings (cf. `G-029`).
- **RFC ouverte** : non — tous les changements ci-dessus sont des corrections techniques de compatibilité de dépendances (pas des décisions de contrat/produit gelées), cf. `03_PROCESSUS_RFC_RESOLUTION_DEFAUT.md` scope.
- **Prochain propriétaire** : Intégrateur (agent) ou humain. Deux chemins possibles :
  1. Fournir un remote Git → push → confirmer CI verte → Bootstrap 0 formellement clos.
  2. Sans attendre le remote, continuer Vague A : `AUTH-01` (middleware identité locale) et `META-01` (`GET /meta`) sont les prochaines tâches non bloquées (dépendent seulement de `FND-09`, déjà acquis). `V3-INF-01` (séparer les tsconfig) est déjà fait de facto (les 4 tsconfig existaient et typechecked séparément). `V3-BOOT-01`/`V3-BOOT-02` restent à cocher une fois le remote/CI en place.

---

### 2026-08-24 — Identité + permissions + /me + /meta (AUTH-01..05, META-01)

- **Task IDs** : AUTH-01 (middleware identité locale), AUTH-02 (validation Cloudflare Access), AUTH-03 (lookup user actif/rôle), AUTH-04 (helpers permissions), AUTH-05 (`GET /me`), META-01 (`GET /meta`)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent) — implémente en une passe le propriétaire "3" (auth) puis "4" (endpoints), l'utilisateur ayant choisi de poursuivre sans attendre un remote Git.
- **Décision de suite** : demandé à l'utilisateur (Bootstrap 0 fait, CI bloquée faute de remote) → réponse : « Continuer Vague A sans remote ». D'où cet enchaînement direct sur AUTH/META.
- **Commit(s)** : voir `git log` (commit qui suit cette entrée)
- **Fichiers produits** :
  - `worker/domain/errors.ts` — `ErrorCode`, `AppError` (code→status HTTP), `errorBody()`/`okBody()` (enveloppe `{ok,data}` / `{ok:false,error:{code,message,fields?,requestId}}` de `02_contrats/05_ERREURS.md`).
  - `worker/domain/types.ts` — `AppEnv` (`Bindings: Env` généré par `wrangler types` + `Variables: {requestId,user}`), type partagé par tous les routers Hono.
  - `worker/db/users.ts` — `findUserByEmail` (mapping snake_case→camelCase selon `02_contrats/01_CONVENTIONS_NOMMAGE.md`).
  - `worker/db/reference.ts` — `listActiveReferences(db, table)` générique pour les 5 tables référentielles (locations/departments/categories/subcategories/impact_types), ne retourne que `active=1`.
  - `worker/auth/access.ts` — `verifyAccessJwt()` (jose `jwtVerify`, issuer/audience Cloudflare Access), `getKey` injecté pour rester testable sans réseau.
  - `worker/auth/identity.ts` — `resolveIdentityEmail()` : branche `X-Dev-User-Email` si `APP_ENV==="local"` (impossible sinon, cf. guardrail), sinon jeton `Cf-Access-Jwt-Assertion` vérifié via JWKS distant (`createRemoteJWKSet`, caché en module).
  - `worker/auth/middleware.ts` — `requireUser` (identité→user D1→actif, sinon 401/403) et `requireRole(...roles)` (403 sinon).
  - `worker/routes/session.ts` (`GET /me`), `worker/routes/meta.ts` (`GET /meta`), `worker/services/meta.ts` (assemble les 5 référentiels + config depuis les vars d'env).
  - `worker/index.ts` — middleware `requestId` global + `app.onError` (formatte `AppError` en réponse structurée, sinon 500 `INTERNAL_ERROR` avec `console.error` côté serveur, jamais de détail interne renvoyé au client).
  - Tests : `tests/api/access.test.ts` (JWT valide/mauvaise audience/mauvais issuer/sans claim email, JWKS local via `jose.createLocalJWKSet`), `tests/api/session.test.ts` (401 sans header, 401 identité sans user D1, 403 `USER_INACTIVE`, 200 + email insensible à la casse), `tests/api/meta.test.ts` (401 sans identité, 200 avec filtrage `active=1` + config exacte), `tests/api/permissions.test.ts` (`requireRole` 403/200 sur une mini-app dédiée, aucune route réelle ne consommait encore ce helper).
  - `tsconfig.worker.json` — ajout de `worker-configuration.d.ts` à `include` (nécessaire pour que `worker/index.ts` utilise le type `Env` généré au lieu d'un type `Bindings` dupliqué manuellement — dette notée dans l'entrée précédente, résorbée ici).
  - Suppression des `.gitkeep` dans `worker/{auth,db,domain,routes,services}` et `tests/api` (dossiers plus vides).
- **Décisions d'implémentation non explicitement tranchées par les contrats** (documentées ici faute de mécanisme RFC formel pour du pur détail d'implémentation, cf. `03_PROCESSUS_RFC_RESOLUTION_DEFAUT.md` — aucune de ces décisions ne modifie un contrat gelé) :
  - Identité introuvable en base (`utilisateur existant` §2 du contrat sécurité) → `401 UNAUTHORIZED`, pas `403`. Raison : tant que l'identité n'a pas de compte interne correspondant, le système ne peut distinguer "connu mais interdit" de "inconnu" — `401` est plus prudent et n'expose pas l'existence ou non d'un compte.
  - `worker/domain/` choisi comme emplacement des types/erreurs transverses (pas de dossier `worker/shared/`) : l'arborescence figée (`03_execution/01_STACK_ET_ARBORESCENCE.md`) ne prévoit que `auth/db/domain/routes/services/validation`, et les codes d'erreur + enveloppe de réponse sont des concepts de domaine communs à toutes les routes.
  - `requireRole` n'est encore câblé sur aucune route réelle (aucun endpoint Vague A n'a de restriction de rôle) : testé isolément via une mini-app Hono jetable dans `tests/api/permissions.test.ts`. Sera réutilisé tel quel dès `ADM-*`/`FLOW-*`.
- **Commandes exécutées** :
  - `npm run types:worker` (régénère `worker-configuration.d.ts`, non commité)
  - `npm run typecheck:worker`, `npm run typecheck:test` → OK
  - `npx vitest run tests/api/*.test.ts` puis `npm run test` (suite complète) → **13/13 tests passés** (2 santé/migrations pré-existants + 4 access + 5 session + 2 meta) — la suite `permissions.test.ts` (2 tests) a été ajoutée après coup, total final non re-vérifié à 15 avant le `npm run verify` final (voir ligne suivante, qui inclut bien tous les fichiers de `tests/api`).
  - `npm run verify` (from clean, fichiers générés + `dist/`/`.wrangler/` supprimés avant) → **exit 0**
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non. La branche `AUTH-02` (validation Cloudflare Access réelle) n'est testée qu'unitairement avec un JWKS local signé par le test (`jose.generateKeyPair`) — aucun Cloudflare Access réel n'est configuré (`ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` sont encore `REPLACE_ME` dans `wrangler.jsonc`). La validation bout-en-bout contre un vrai tenant Access est explicitement `OPS-02` (backlog), pas de ce lot.
- **Limitations connues / dette** :
  - Aucune donnée de test insérée automatiquement pour `default_location_id`/`default_department_id` des utilisateurs de test (nullable en base, donc pas bloquant, mais les futurs endpoints `issues` avec `location_id NOT NULL` devront seeder plus que `users`+`locations` minimalement dans leurs propres tests).
  - `console.error` est utilisé pour logger les erreurs 500 côté serveur (`requestId`, erreur sérialisée) — c'est un log minimal, pas encore l'observabilité complète attendue par `OPS-03` (route, statut HTTP, durée systématiques sur *toutes* les requêtes, pas seulement les 500). Ne pas confondre avec "fait" : `OPS-03` reste entièrement à faire.
  - Le rate limiting (`WRITE_RATE_LIMIT`/`UPLOAD_RATE_LIMIT`, déjà dans `wrangler.jsonc`) n'est câblé sur aucune route pour l'instant — normal, aucune route d'écriture n'existe encore (Vague B).
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain. Prochaines tâches non bloquées dans le backlog :
  - `META-02` (bootstrap session/meta côté UI React : appeler `/me`+`/meta`, gérer 401/403/loading) — dépend de `AUTH-05`+`META-01`, tous deux faits ici.
  - `ISSUE-01`/`ISSUE-02` (mapper D1↔API Issue, générer `publicId` à partir de `issues.id`) peuvent démarrer en parallèle (dépendent de `FND-08`, déjà fait) sans attendre `META-02`.
  - Rappel : `PublicId` est déjà défini dans `contracts/openapi.yaml` (`^INC-[0-9]{6,}$`, ex. `INC-000042`) — `ISSUE-02` n'a qu'à implémenter le formatage/parsing, pas à redéfinir le format.

---
