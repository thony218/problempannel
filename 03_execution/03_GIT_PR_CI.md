# Git, PR et CI V4

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## Précondition

La CI officielle suppose que Bootstrap 0 a été exécuté et que `package-lock.json` est commité.

## CI

```bash
npm ci
npm run verify
```

Aucun repli `npm install`.
Aucun `--ignore-scripts`.

Si le lockfile manque, la CI doit échouer : le dépôt n'est pas prêt.

## Verify

Inclut :
- lint OpenAPI;
- génération types;
- typecheck app;
- typecheck Worker;
- typecheck Vitest;
- typecheck Playwright;
- tests Vitest/D1;
- build.

## E2E

Les E2E sont séparés parce qu'ils nécessitent des navigateurs :

```bash
npm run test:e2e:install
npm run test:e2e
```

Le pipeline de staging doit les exécuter avant GO production.
