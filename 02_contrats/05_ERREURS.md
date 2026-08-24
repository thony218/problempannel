# Contrat de gestion des erreurs

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Backend + frontend**  
> Statut : **FROZEN**

## Format unique

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Message lisible.",
    "fields": {},
    "requestId": "req_..."
  }
}
```

## Codes minimum

- `BAD_REQUEST`
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `USER_INACTIVE`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `PRECONDITION_REQUIRED`
- `INVALID_STATUS_TRANSITION`
- `FILE_TOO_LARGE`
- `UNSUPPORTED_FILE_TYPE`
- `ATTACHMENT_LIMIT_REACHED`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

## Frontend

Le comportement dépend de `error.code`, jamais du texte humain.

## Backend

Une erreur métier connue ne doit pas être transformée en `500`.
