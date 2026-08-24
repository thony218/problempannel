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
| Vague A — Fondations | EN COURS (FND-* + AUTH-01..05 + META-01 + ISSUE-01/02/03/04 + LIST-01/02/03 + DETAIL-01 faits ; META-02 UI, ISSUE-05+, FLOW-* restent) |
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

### 2026-08-24 — publicId + mapper D1↔API Issue (ISSUE-01, ISSUE-02)

- **Task IDs** : ISSUE-02 (générer/résoudre `publicId`), ISSUE-01 (mapper D1↔API Issue), + un correctif sur META-01
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent), suite directe de l'entrée précédente sur demande explicite de l'utilisateur (« continue directement sur ISSUE-01/ISSUE-02 »).
- **Commit(s)** : voir `git log` (commit qui suit cette entrée)
- **Correctif avant de commencer** : `worker/db/reference.ts` ne renvoyait jamais `ReferenceItem.parentId`, alors que le schéma OpenAPI le prévoit précisément pour que les sous-catégories s'associent à leur catégorie côté UI (`subcategories.category_id` → `parentId`). Sans ça, `META-01` était incomplet en pratique même si `npm run verify` passait (le champ est optionnel dans le schéma, donc son absence ne cassait aucun test). Corrigé : `listActiveReferences` accepte maintenant une colonne parent par table (seule `subcategories` en a une), `tests/api/meta.test.ts` vérifie que `parentId` d'une sous-catégorie correspond bien à l'id de sa catégorie et que les tables sans parent ne renvoient pas le champ.
- **Fichiers produits** :
  - `worker/domain/publicId.ts` — `toPublicId(id)` (`INC-` + id paddé à 6 chiffres minimum) et `parsePublicId(publicId)` **strict** : recalcule la forme canonique et rejette toute variante non canonique (ex. `INC-0000042` pour l'id 42), tout format non numérique, moins de 6 chiffres, ou id ≤ 0 → `null` (donc 404 en amont, cf. `V4-ID-01`).
  - `worker/db/issues.ts` — `mapIssueRow(row): ApiIssue` (D1→API uniquement, voir décision de portée ci-dessous), tables de correspondance d'énumérations bidirectionnelles (`STATUS_API_TO_DB`, `CAUSE_STATUS_API_TO_DB`, `PERMANENT_CORRECTION_TYPE_API_TO_DB` déjà exportées pour `ISSUE-03`), composition de `waitingOn` (objet discriminé `user` vs `customer/supplier/other`) à partir des 3 colonnes D1, et `findIssueByPublicId(db, publicId)` (parse strict + lecture D1 + mapping, `null` si format invalide ou id inconnu — pas de requête D1 gaspillée sur un format invalide).
  - Le mapper importe les types depuis **`src/shared/api-types.generated.ts`** (`components["schemas"]["Issue"]` etc.) au lieu de redéfinir un type `Issue` à la main, conformément à `G-029` (types générés = seule définition).
  - Tests : `tests/api/public-id.test.ts` (round-trip, rejet du padding non canonique, formats invalides, id 0), `tests/api/issues-mapper.test.ts` (mapping de chaque énumération, `waitingOn` dans ses deux variantes, passthrough des métadonnées de résolution/caviardage), `tests/api/issues-db.test.ts` (lecture réelle sur D1 : id inconnu bien formé → `null`, format invalide → `null` sans requête, dossier réel retrouvé et mappé).
- **Décision de portée (documentée faute de RFC applicable — pur détail d'implémentation, aucun contrat gelé modifié)** : `ISSUE-01` ne construit que la direction **lecture** (D1 row → `Issue` API), pas l'inverse (`CreateIssueRequest`/`UpdateIssueRequest` → colonnes D1). Raison : la direction écriture doit composer avec des règles qui appartiennent explicitement à `ISSUE-03` (`POST /issues`, preuve = scénarios `S01-S03` de `01_produit/07_SCENARIOS_ACCEPTATION.md`, pas encore lus en détail) — génération de `row_version=1`, `status` par défaut, validation Zod (`worker/validation/`), et permissions (`AUTH-04`). Construire cette direction maintenant sans les scénarios d'acceptation sous les yeux risquait de la faire à moitié puis de la refaire. Les tables de correspondance d'énumération **API→DB** sont déjà exportées et prêtes à être réutilisées telles quelles par `ISSUE-03`, donc rien n'est perdu.
- **Commandes exécutées** :
  - `npm run typecheck:worker`, `npm run typecheck:test` → OK
  - `npx vitest run tests/api/public-id.test.ts tests/api/issues-mapper.test.ts tests/api/issues-db.test.ts` → 16/16
  - `npm run verify` (from clean) → **exit 0**, **31/31 tests** (9 fichiers)
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non (aucune route HTTP nouvelle exposée — `findIssueByPublicId` est un accès D1 direct testé en intégration Miniflare, pas encore branché sur un endpoint).
- **Limitations connues / dette** :
  - Aucun endpoint `GET /issues/{publicId}` n'existe encore (c'est `DETAIL-01`, qui doit aussi ajouter l'en-tête `ETag: "issue-{id}-v{rowVersion}"` — pas construit ici, mais `findIssueByPublicId` lui donne directement ce dont il a besoin).
  - La direction API→D1 du mapper (écriture) reste à faire dans `ISSUE-03`, voir décision de portée ci-dessus.
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain.
  - `ISSUE-03` (`POST /issues`) est la suite naturelle : lire `01_produit/07_SCENARIOS_ACCEPTATION.md` (S01-S03) et `01_produit/03_MATRICE_TRANSITIONS.md` avant d'implémenter, réutiliser `STATUS_API_TO_DB`/`CAUSE_STATUS_API_TO_DB`/`PERMANENT_CORRECTION_TYPE_API_TO_DB` de `worker/db/issues.ts`, brancher `requireUser`/`requireRole` de `worker/auth/middleware.ts`, valider avec Zod dans `worker/validation/` (dossier encore vide).
  - Alternative non bloquée : `DETAIL-01` (`GET /issues/{publicId}` + ETag) ne dépend que d'`ISSUE-03` selon le backlog écrit, mais en pratique un `GET` sans `POST` au préalable n'a rien à lire en staging — mieux vaut faire `ISSUE-03` d'abord même si l'ordre strict du backlog ne l'impose pas explicitement.

---

### 2026-08-24 — POST /issues (ISSUE-03, S01-S03)

- **Task IDs** : ISSUE-03 (`POST /issues`)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent), suite directe sur demande explicite (« continue directement sur ISSUE-01/ISSUE-02 » puis enchaînement naturel sur ISSUE-03 une fois le mapper prêt).
- **Lu avant d'implémenter** : `01_produit/07_SCENARIOS_ACCEPTATION.md` (S01-S03), `01_produit/01_CONTRAT_FONCTIONNEL_FINAL.md` (§1 Déclaration), `01_produit/02_DICTIONNAIRE_CHAMPS.md` (§Impacts : `none_external` exclusif, `other` exige `details`).
- **Commit(s)** : voir `git log` (commit qui suit cette entrée)
- **Fichiers produits** :
  - `worker/validation/request.ts` — `parseJsonBody(c, schema)` générique (JSON malformé → 400 `BAD_REQUEST`, schéma Zod invalide → 422 `VALIDATION_ERROR` avec un `fields[chemin] = message` par erreur), réutilisable pour tout futur POST/PATCH.
  - `worker/validation/issues.ts` — `createIssueRequestSchema` (Zod, miroir strict de `CreateIssueRequest` dans `contracts/openapi.yaml` : `z.strictObject` pour `additionalProperties:false`, `z.iso.date()` pour les dates civiles, mêmes bornes `min/max`).
  - `worker/services/issues.ts` — `createIssue(db, createdByUserId, input)` : valide que `locationId`/`categoryId` existent et sont actifs, que `departmentId`/`subcategoryId` (si fournis) existent et sont actifs, que la sous-catégorie appartient bien à la catégorie choisie (`subcategory.parentId === category.id`), qu'aucun `impactTypeId` n'est dupliqué, que chaque type d'impact existe/est actif, que `other` a un `details` non vide, et que `none_external` n'est jamais combiné à un autre impact. Toutes les erreurs de champs sont accumulées et renvoyées en un seul 422 (meilleure UX qu'un aller-retour par champ).
  - `worker/db/issues.ts` — `insertIssue()` : insertion atomique dossier+impacts en **un seul `db.batch()`** : la requête `issues` utilise `RETURNING` pour renvoyer la ligne complète (avec les valeurs par défaut SQLite : `status='new'`, `row_version=1`, `created_at`/`updated_at`), et les requêtes `issue_impacts` référencent l'id généré via `last_insert_rowid()` **en SQL** plutôt qu'un id relu puis re-bindé côté application — ce qui évite toute fenêtre non atomique entre les deux écritures (D1 ne permet pas de transaction pilotée par l'application avec lecture intermédiaire, seulement `db.batch()`). **Cette hypothèse a été vérifiée empiriquement** (pas supposée) : le test "persists the issue and its impacts atomically" confirme qu'après un seul appel à l'endpoint, le dossier ET ses impacts sont bien présents et cohérents sur le D1 réel (Miniflare, même moteur que `wrangler dev`).
  - `worker/db/reference.ts` — ajout de `findActiveReferenceById` et `findActiveReferencesByIds` (validations d'existence/activité, utilisées par le service ci-dessus).
  - `worker/domain/etag.ts` — `issueETag(id, rowVersion)` = `"issue-{id}-v{rowVersion}"` (`02_contrats/03_CONTRAT_API.md`). Nécessaire dès `ISSUE-03` (pas seulement `DETAIL-01`) car le contrat OpenAPI exige un en-tête `ETag` sur la réponse `201` de `POST /issues`, pas seulement sur `GET`/`PATCH`.
  - `worker/routes/issues.ts` — `POST /issues` : `requireUser` (n'importe quel utilisateur actif peut créer, cf. matrice de permissions : "Créer issue: oui/oui/oui"), parse+valide le corps, appelle le service, pose l'en-tête `ETag`, répond `201` avec l'enveloppe `{ok:true,data:Issue}`.
  - Tests (`tests/api/issues-create.test.ts`, 15 cas) : **S01** (création valide + `ETag` + `status=new` + `rowVersion=1`), **S02** (sans `locationId` → 422), succursale inactive → 422, **S03** (sans sous-catégorie → accepté), sous-catégorie valide acceptée, sous-catégorie d'une autre catégorie refusée, description trop courte, `impacts` vide refusé, `impactTypeId` dupliqué refusé, `none_external` combiné refusé, `other` sans détail refusé puis accepté avec détail, atomicité dossier+impacts vérifiée en relisant D1 directement, champ hors schéma refusé (`additionalProperties:false`), 401 sans identité.
- **Commandes exécutées** :
  - `npm run typecheck:worker` → OK
  - `npx vitest run tests/api/issues-create.test.ts` → 15/15 (1 échec initial dû à un mauvais fixture de test — `"trop court"` fait exactement 10 caractères donc passe `minLength:10` — corrigé dans le test, pas dans le code)
  - `npm run verify` (from clean) → **exit 0**, **46/46 tests** (10 fichiers)
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non.
- **Limitations connues / dette** :
  - Pas d'écriture dans `issue_history` (`issue_created`) — c'est explicitement `ISSUE-04`, tâche suivante, avec sa propre preuve ("event test"). Ne pas confondre avec "fait".
  - Pas de rate limiting appliqué sur cette route d'écriture (`WRITE_RATE_LIMIT` existe dans `wrangler.jsonc` mais n'est câblé sur aucune route — reste `OPS-03`/futur, cf. entrée précédente).
  - `UpdateIssueRequest` (PATCH) n'est pas traité ici — c'est `FLOW-01`. Les tables de correspondance d'énumération API→DB dans `worker/db/issues.ts` sont déjà prêtes à être réutilisées par ce futur endpoint.
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain.
  - `ISSUE-04` (historique `issue_created`) est la suite la plus naturelle : append-only dans `issue_history` (`event_type='issue_created'`, `payload_json` — attention à `S35` : ne jamais recopier de texte libre modifiable dans `payload_json`, seulement des métadonnées structurelles), appelé depuis `worker/services/issues.ts::createIssue` dans le même `db.batch()` que l'insertion (à vérifier si `RETURNING`+`last_insert_rowid()` combiné à un 3e type de statement pose un problème — probablement pas, mais à tester comme cette entrée l'a fait pour issues+impacts).
  - Ensuite `ISSUE-05`/`ISSUE-06`/`ISSUE-07` sont du frontend (formulaire mobile + brouillon IndexedDB + intégration staging) — nécessitent `META-02` (bootstrap UI) au préalable, qui lui-même ne dépend que d'`AUTH-05`+`META-01` (déjà faits) et peut donc être fait en parallèle si un autre worker préfère attaquer le frontend plutôt que de continuer le backend `ISSUE-*`.

---

### 2026-08-24 — Historique issue_created (ISSUE-04) + correctif d'un bug réel dans l'insert atomique

- **Task IDs** : ISSUE-04 (historique `issue_created`), + correctif critique dans `insertIssue` (touche `ISSUE-03`)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent), sur demande explicite (« continue sur ISSUE-04 »).
- **Bug réel trouvé en commençant ISSUE-04 (avant tout nouveau code)** : `insertIssue()` (`worker/db/issues.ts`, écrit dans l'entrée `ISSUE-03`) insérait chaque impact dans **une instruction séparée**, chacune utilisant `last_insert_rowid()`. Cette fonction reflète le **dernier** insert sur la connexion — donc avec 2+ impacts, le 2e insert d'impact aurait utilisé l'id généré par le 1er impact comme `issue_id`, pas l'id du dossier. Les 15 tests d'`ISSUE-03` ne l'ont jamais détecté car **tous** leurs payloads n'utilisaient qu'un seul impact (le seul cas où `last_insert_rowid()` reste correct, puisque l'insert d'impact suit immédiatement l'insert du dossier). Non détecté par `npm run verify` non plus, puisque les tests eux-mêmes ne couvraient pas ce cas.
  - **Correctif** : les impacts sont maintenant insérés en **une seule instruction multi-lignes** (`INSERT ... SELECT ... FROM (VALUES (?,?), (?,?), ...)`), qui ne dépend que d'**une seule** évaluation de `(SELECT id FROM issues ORDER BY id DESC LIMIT 1)` — sûr parce qu'un `db.batch()` D1 est une transaction atomique (aucune autre écriture concurrente ne peut s'intercaler), donc "le dossier au plus grand id" désigne forcément et uniquement celui qu'on vient de créer, peu importe combien d'autres inserts (impacts, historique) suivent dans le même batch.
  - **Détail SQL piégeux découvert au passage** : la syntaxe `FROM (VALUES (?,?), (?,?)) AS v(col1, col2)` (nommage de colonnes standard SQL) **n'est pas supportée par SQLite/D1** — erreur `D1_ERROR: near "(": syntax error`. Vérifié par un `wrangler d1 execute --local` direct (pas juste supposé). Il faut utiliser les noms de colonnes par défaut que SQLite assigne (`column1`, `column2`, ...).
  - **Test de régression ajouté** : `tests/api/issues-create.test.ts` a maintenant un cas avec **3 impacts distincts**, qui vérifie explicitement qu'aucune ligne `issue_impacts` ne pointe vers un `issue_id` différent de celui du dossier créé (`orphanCount` = 0). Ce test aurait échoué avec l'ancien code.
- **Fichiers produits** :
  - `worker/db/history.ts` — `insertHistoryEventStatement(db, issueId, event)` (cas général : id déjà connu, ex. futur `PATCH`) et `insertHistoryEventForJustCreatedIssueStatement(db, event)` (cas spécifique à la création, même sous-requête `ORDER BY id DESC LIMIT 1` que pour les impacts). `NewHistoryEvent.payload` documenté comme strictement structurel (jamais de texte libre, cf. `01_produit/09_CAVIARDAGE_ET_HISTORIQUE.md`).
  - `worker/db/issues.ts` — `insertIssue()` réécrit : 3 instructions dans un seul `db.batch()` (dossier avec `RETURNING`, impacts en une seule requête multi-lignes, historique `issue_created`). Le payload de l'événement contient `locationId`, `departmentId`, `categoryId`, `subcategoryId`, `priority` — jamais `description` (texte libre).
  - Tests ajoutés à `tests/api/issues-create.test.ts` : régression multi-impacts (ci-dessus) et vérification de l'événement `issue_created` (bon `actorUserId`, `eventType`, payload structurel exact, absence du texte de la description dans le payload sérialisé).
- **Commandes exécutées** :
  - `npx wrangler d1 execute DB --local --command="SELECT column1, column2 FROM (VALUES (1,2),(3,4));"` → confirme la syntaxe SQLite correcte avant de l'utiliser dans le code
  - `npm run typecheck:worker` → OK
  - `npx vitest run tests/api/issues-create.test.ts` → 17/17 (7 échecs intermédiaires pendant le débogage de la syntaxe SQL, tous corrigés avant ce résultat)
  - `npm run verify` (from clean) → **exit 0**, **48/48 tests** (10 fichiers)
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non. Note : la vérification manuelle sur le vrai D1 local (`wrangler d1 execute --local`) n'a pu être refaite après le `rm -rf .wrangler` du cycle "verify from clean" (état local éphémère, normal) — la confiance repose sur Miniflare (même moteur D1/SQLite que `wrangler dev`) plus le test direct de la syntaxe `VALUES` fait séparément ci-dessus.
- **Limitations connues / dette** :
  - Aucune — `ISSUE-04` est maintenant complet pour le flux de création. Les futurs endpoints d'écriture (`PATCH /issues/{publicId}`, commentaires, actions correctives, pièces jointes, liens) devront chacun ajouter leur propre événement d'historique via `insertHistoryEventStatement` (id déjà connu dans ces cas, pas besoin de la variante "just created").
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain.
  - Le cœur `ISSUE-*` de création est maintenant complet et testé (mapper, publicId, création, historique). Suite naturelle côté backend : `LIST-01`/`LIST-02` (pagination curseur + `GET /issues` avec filtres) ou `DETAIL-01` (`GET /issues/{publicId}` + ETag, réutilise directement `findIssueByPublicId` déjà écrit).
  - Alternative côté frontend : `META-02` (bootstrap session/meta UI) ne dépend que de travail déjà fait (`AUTH-05`, `META-01`) et peut démarrer indépendamment.
  - **Rappel méthodologique pour la suite** : quand une requête D1 combine plusieurs statements dans un même `db.batch()` avec une dépendance entre eux (ex: enfant qui a besoin de l'id généré par le parent), ne jamais supposer qu'une construction SQL "standard" fonctionne sous SQLite — la valider par un `wrangler d1 execute --local` direct avant de l'intégrer, et écrire un test avec **au moins 2 lignes enfants** pour détecter une dérive de `last_insert_rowid()` comme celle corrigée ici.

---

### 2026-08-24 — Pagination curseur opaque + GET /issues filtré & recherche q (LIST-01, LIST-02, LIST-03)

- **Task IDs** : LIST-01 (pagination curseur opaque), LIST-02 (`GET /issues` + filtres), LIST-03 (recherche `q` avec échappement SQLite)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent), sur confirmation de plan d'implémentation par l'utilisateur.
- **Fichiers produits/modifiés** :
  - `worker/domain/cursor.ts` — `encodeCursor({ id })` et `decodeCursor(cursor)` (encodage/décodage Base64URL d'un payload JSON d'ID, résistant aux chaînes malformées/invalides/négatives).
  - `worker/validation/request.ts` — `parseQueryParams(c, schema)` (supporte les query params simples et répétés sous forme de tableaux, validation Zod vers 422 `VALIDATION_ERROR`).
  - `worker/validation/issues.ts` — `listIssuesQuerySchema` (validation et coercion des query params : `cursor`, `limit` [1..100, def 25], `q` [2..40], `status` multi-valeurs, `priority` multi-valeurs, `locationId`, `departmentId`, `categoryId`, `ownerUserId`, `from`, `to`, `overdue`, `effectivenessStatus`, `effectivenessReviewDueBefore`).
  - `worker/db/issues.ts` — `queryIssuesList(db, params)` (requête SQL D1 paramétrée dynamique : filtre par curseur `id < ?`, statuts/priorités `IN (...)`, filtres d'IDs, filtres de dates `occurred_on`, filtre `overdue` [due_date passée et non résolu], filtre `effectiveness_status`, filtre `effectiveness_review_due_before` [résolu pending et review_date <= date], recherche `q` [par format `INC-XXXXXX` / ID exact ou `description LIKE ? ESCAPE '\'`], tri `ORDER BY id DESC LIMIT ? + 1` pour déterminer `hasMore`).
  - `worker/services/issues.ts` — `listIssues(db, query)` (validation/décodage du curseur en amont avec 422 en cas de corruption, appel de `queryIssuesList`, mapping des lignes et composition de `nextCursor`).
  - `worker/routes/issues.ts` — `GET /issues` : `requireUser`, parse des query params, réponse standardisée 200 `{ ok: true, data: { items, nextCursor, hasMore } }`.
  - Tests : `tests/api/cursor.test.ts` (3 tests unitaires de round-trip, entiers variés, rejets de malformations), `tests/api/issues-list.test.ts` (16 tests d'intégration : 401 non authentifié, liste vide, pagination complète page par page, rejet curseur invalide, statuts simples et multiples, priorités, succursales/départements/catégories/assignés, plages de dates, filtre overdue, révisions dues, recherche mot-clé avec caractères spéciaux `%` et `_`, recherche `INC-XXXXXX`, validations limites/dates).
- **Points notables découverts et validés** :
  - La contrainte SQLite `status = 'new' OR subcategory_id IS NOT NULL` (décision D-07 / V3-TRIAGE-01) a été scrupuleusement respectée dans les fixtures des tests pour tous les dossiers ayant un statut non `new`.
  - Pour les tests de pagination et de recherche par identifiant, les `publicId` réels retournés par les requêtes D1 `RETURNING id` sont utilisés dynamiquement pour éviter toute dépendance à l'état de `sqlite_sequence`.
- **Commandes exécutées** :
  - `npm run typecheck` (app, worker, test, e2e) → OK (0 erreur)
  - `npm run contract:lint` → OK (0 erreur, 1 warning explicable sur `/health`)
  - `npx vitest run tests/api/cursor.test.ts` → 3/3 passés
  - `npx vitest run tests/api/issues-list.test.ts` → 16/16 passés
  - `npm run test` (suite complète de tests) → **67/67 passés** (12 fichiers)
  - `npm run verify` (from clean) → **exit 0**, **67/67 tests**
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non.
- **Limitations connues / dette** :
  - `GET /issues/{publicId}` n'est pas encore exposé en route HTTP (c'est `DETAIL-01`, qui utilisera `findIssueByPublicId` déjà implémenté dans `worker/db/issues.ts`).
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain.
  - Côté backend : `DETAIL-01` (`GET /issues/{publicId}` + ETag) suivi de `FLOW-01` à `FLOW-04` (`PATCH /issues/{publicId}`, `If-Match`, gestion des conflits 409 et matrice de transitions).
  - Côté frontend : `META-02` (Bootstrap React / Auth / Meta) pour démarrer l'UI, suivi de `ISSUE-05` (Formulaire Nouveau) et `LIST-04` (Écran Registre mobile).

---

### 2026-08-24 — GET /issues/{publicId} + ETag (DETAIL-01)

- **Task IDs** : DETAIL-01 (`GET /issues/{publicId}` + ETag)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent), sur choix explicite de l'utilisateur entre `DETAIL-01` (backend) et `META-02` (frontend) — `DETAIL-01` retenu.
- **Lu avant d'implémenter** : `contracts/openapi.yaml` (`IssueDetailResponse`/`IssueDetail`/`Impact`/`CorrectiveAction`), `02_contrats/03_CONTRAT_API.md` (format `ETag`), `migrations/0001_core.sql` (tables `issue_impacts`, `corrective_actions`).
- **Commit(s)** : voir `git log` (commit qui suit cette entrée)
- **Fichiers produits/modifiés** :
  - `worker/db/impacts.ts` — `findImpactsByIssueId(db, issueId)` : lecture `issue_impacts`, mapping direct vers `Impact` API (`{id, impactTypeId, details}`).
  - `worker/db/corrective-actions.ts` — `findCorrectiveActionsByIssueId(db, issueId)` : lecture `corrective_actions`, mapping D1→API (`issue_id`→`issuePublicId` via `toPublicId`, `status` D1↔API comme pour `issues`, `blocks_issue_closure` 0/1→boolean). Aucun endpoint d'écriture n'existe encore pour cette table (`ACT-01`+), mais la table elle-même existe depuis `FND-08` : ce lot ne fait que la lire.
  - `worker/services/issues.ts` — `getIssueDetail(db, publicId)` : parse le `publicId`, lit en parallèle (`Promise.all`) le dossier + ses impacts + ses actions correctives par id numérique, renvoie `null` si format invalide ou dossier inconnu (même contrat que `findIssueByPublicId`, pas de distinction 404 entre les deux cas côté route, cf. `V4-ID-01`).
  - `worker/routes/issues.ts` — `GET /issues/:publicId` : `requireUser`, 404 `NOT_FOUND` si `getIssueDetail` renvoie `null`, sinon en-tête `ETag: issue-{id}-v{rowVersion}` + 200 `{ok:true,data:IssueDetail}`.
  - Tests (`tests/api/issues-detail.test.ts`, 5 cas) : 401 non authentifié, 404 publicId bien formé mais inconnu, 404 publicId malformé, 200 avec impacts + `ETag` correct + `correctiveActions` vide, 200 avec une action corrective insérée directement en D1 (contournement propre de l'absence d'endpoint d'écriture) et retrouvée mappée correctement dans la réponse.
- **Bug de test trouvé en cours de route (pas un bug produit)** : le fixture de test utilisait `priority: "medium"`, valeur qui n'existe pas dans l'enum `Priority` du contrat (`normal`/`important`/`urgent`) — corrigé dans le test, la validation 422 a fonctionné comme attendu et a révélé l'erreur immédiatement.
- **Commandes exécutées** :
  - `npm run typecheck:worker`, `npm run typecheck:test` → OK
  - `npx vitest run tests/api/issues-detail.test.ts` → 5/5 (1 échec initial dû au fixture `priority` invalide, corrigé)
  - `npm run verify` (from clean) → **exit 0**, **72/72 tests** (13 fichiers)
- **`npm run verify`** : **PASS** (exit 0)
- **Staging testé** : non.
- **Limitations connues / dette** :
  - `PATCH /issues/{publicId}` (`If-Match`/conflits 409/transitions) n'existe pas encore — c'est `FLOW-01..04`, qui réutilisera `issueETag`/`findIssueByPublicId` déjà écrits.
  - `corrective_actions` n'a toujours aucun endpoint d'écriture (`ACT-01`/`ACT-02`) : la table est lue mais jamais peuplée par l'API elle-même pour l'instant, uniquement testée via insertion D1 directe.
- **RFC ouverte** : non.
- **Prochain propriétaire** : Intégrateur (agent) ou humain.
  - Côté backend : `FLOW-01` (`PATCH /issues/{publicId}` avec `If-Match`, 409/428) est la suite naturelle — réutilise `issueETag`, `findIssueByPublicId`, et les tables de correspondance d'énumération déjà exportées dans `worker/db/issues.ts`. Lire `01_produit/03_MATRICE_TRANSITIONS.md` avant d'implémenter (16 cellules à couvrir, cf. `FLOW-02`).
  - Côté frontend : `META-02` reste non démarrée et non bloquée (dépend seulement d'`AUTH-05`+`META-01`, déjà faits).

---

