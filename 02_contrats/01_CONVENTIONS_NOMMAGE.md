# Conventions universelles de nommage

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Architecture**  
> Statut : **FROZEN**

## Base D1
Toujours `snake_case`.

Exemples : `owner_user_id`, `due_date`, `created_at`.

## API JSON et TypeScript
Toujours `camelCase`.

Exemples : `ownerUserId`, `dueDate`, `createdAt`.

## Types/interfaces/classes
Toujours `PascalCase`.

## Mapping obligatoire

```text
D1 snake_case
   ↓ mapper backend
Domain/API camelCase
   ↓ types générés OpenAPI
Frontend camelCase
```

Le frontend ne reçoit jamais de `snake_case`.

## Enums multi-mots

D1 : `in_progress`  
API : `inProgress`

## Dates

- datetime API : ISO 8601 UTC;
- date civile : `YYYY-MM-DD`;
- fuseau métier : `America/Toronto`.

## Null

Absence intentionnelle = `null`. Ne jamais utiliser `""`, `0` ou `"N/A"` comme remplacement.

## Recherche

`q` :
- minimum 2 caractères;
- maximum 40 caractères;
- le backend applique aussi une limite de 160 octets UTF-8 pour éviter les requêtes abusives.
