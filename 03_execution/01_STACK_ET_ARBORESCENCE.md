# Stack et arborescence V4

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Architecture**  
> Statut : **FROZEN**

## Stack figée

- Node 24 LTS
- npm + package-lock
- TypeScript
- React
- Vite
- Cloudflare Vite plugin
- React Router
- Hono
- Zod
- OpenAPI 3.1
- openapi-typescript
- Vitest + Cloudflare Vitest plugin
- Playwright
- Wrangler
- D1
- R2
- Cloudflare Access

## Arborescence réelle livrée

```text
/
├── .github/workflows/ci.yml
├── 00_gouvernance/
├── 01_produit/
│   └── ux/
├── 02_contrats/
├── 03_execution/
├── 04_cahiers_employes/
├── 05_qualite_exploitation/
├── contracts/
│   └── openapi.yaml
├── migrations/
│   └── 0001_core.sql
├── seed/
│   ├── reference.sql
│   └── dev.sql
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── routes/
│   ├── shared/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── worker/
│   ├── auth/
│   ├── db/
│   ├── domain/
│   ├── routes/
│   ├── services/
│   ├── validation/
│   └── index.ts
├── tests/
│   ├── api/
│   ├── e2e/
│   │   └── app.spec.ts
│   ├── fixtures/
│   ├── integration/
│   │   ├── health.test.ts
│   │   └── db-migrations.test.ts
│   └── setup.ts
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.worker.json
├── tsconfig.test.json
├── tsconfig.e2e.json
├── vite.config.ts
├── vitest.config.ts
├── wrangler.jsonc
└── wrangler.template.jsonc
```

Les dossiers avec `.gitkeep` sont intentionnels : ils réservent les frontières de module.

## Interdit

- créer un second dépôt;
- déplacer une responsabilité de dossier sans RFC R1;
- recréer un dossier `scripts/` par habitude sans tâche réelle.
