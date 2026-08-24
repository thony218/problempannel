# Plan maître

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Maître d'orchestre**  
> Statut : **FROZEN**

## Architecture

```text
Navigateur
   |
Cloudflare Access
   |
Worker Cloudflare unique
   |---- React SPA
   |---- /api/*
          |---- D1
          |---- R2 privé
          |---- Rate Limiting
```

## Gel 0

Déjà tranché dans `05_DECISIONS_ARRETEES_GEL0.md`.

## Vague A — Fondations

- dépôt + CI;
- D1 + seeds;
- auth;
- OpenAPI;
- types générés;
- UX de base;
- metadata/référentiels.

### Gel A

`npm run verify` doit retourner 0.

## Vague B — Tranches verticales

1. identité;
2. créer;
3. lister/rechercher;
4. détail;
5. workflow;
6. commentaires;
7. pièces jointes;
8. actions correctives;
9. historique;
10. administration.

L'intégrateur travaille dès le premier endpoint.

## Vague C

- analytique;
- récurrences;
- QA;
- performance;
- sécurité;
- mobile.

## Vague D

- gate confidentialité;
- recette finale;
- production;
- smoke tests;
- exploitation.

## Règle

Un écran qui fonctionne seulement contre un mock n'est pas terminé.
