# Rapport de validation du paquet V4

> Date : 2026-08-24  
> Statut : **VALIDÉ STRUCTURELLEMENT ET CONTRACTUELLEMENT**

## Vérifications exécutées

- OpenAPI 3.1 parsable : **PASS**
- Références internes résolues : **PASS — 81 uniques**
- operationId uniques : **PASS — 44**
- Schémas OpenAPI : **57**
- Schémas orphelins : **0**
- Migration sur SQLite vierge : **PASS**
- Seeds référence + dev : **PASS**
- ancien identifiant avec année supprimé : **PASS**
- publicId `INC-{id}` : **PASS**
- Diff `Issue` API ↔ SQL : **PASS**
- location obligatoire : **PASS**
- sous-catégorie obligatoire après `new` : **PASS**
- waiting externe sans libellé refusé : **PASS**
- champs waiting nettoyés hors `waiting` : **PASS**
- caviardage SQL sans raison refusé : **PASS**
- caviardage API sans cible impossible par schéma : **PASS**
- Playwright limité à `tests/e2e` : **PASS**
- Vitest exclut `tests/e2e` : **PASS**
- E2E smoke test présent : **PASS**
- tsconfig app/worker/test/e2e séparés : **PASS**
- CI sans fallback npm install : **PASS**
- arborescence livrée conforme au document : **PASS**
- tâches backlog uniques : **PASS — 92**
- scénarios d'acceptation : **50**
- documents UX : **8**

## Exceptions API ↔ SQL voulues

- `publicId` : dérivé uniquement de `issues.id`.
- `waitingOn` : composé des trois colonnes d'attente.

## Bootstrap 0

Le paquet ne contient pas un lockfile fabriqué sans résolution réelle.

Étape obligatoire dans un environnement Node 24 avec accès npm :

```bash
npm install
npm run verify
npm run test:e2e:install
npm run test:e2e
```

Puis committer `package-lock.json` et vérifier la première CI verte.

C'est le seul blocage mécanique important restant avant parallélisation réelle.
