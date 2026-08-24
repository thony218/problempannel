# Contrat API

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable backend**  
> Statut : **FROZEN**

## Autorité exécutable

`contracts/openapi.yaml`

OpenAPI 3.1.

## Codes HTTP

- JSON malformé : 400
- non authentifié : 401
- interdit : 403
- inexistant : 404
- stale version : 409
- validation métier : 422
- If-Match absent : 428
- fichier trop gros : 413
- MIME interdit : 415
- rate limit : 429

## Concurrence

GET/PATCH dossier utilise :

```text
ETag: "issue-42-v7"
If-Match: "issue-42-v7"
```

Le frontend n'envoie jamais un PATCH sans `If-Match`.

## Pagination

```json
{
  "ok": true,
  "data": {
    "items": [],
    "nextCursor": null,
    "hasMore": false
  }
}
```

- défaut : 25;
- maximum : 100;
- curseur opaque.

## Types

`npm run contract:generate`

Les types générés depuis OpenAPI sont la seule définition TypeScript des payloads API. Ils sont régénérés par `npm run verify` et ne sont pas commités.

## Mock

Le mock est dérivé du contrat OpenAPI. Il sert avant la route réelle; jamais comme preuve finale d'intégration.
