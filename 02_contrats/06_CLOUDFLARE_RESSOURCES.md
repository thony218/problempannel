# Contrat des ressources Cloudflare

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## Noms standards

### Dev
- Worker : `registre-erreurs-dev`
- D1 : `registre-erreurs-dev`
- R2 : `registre-erreurs-attachments-dev`
- Access : `Registre erreurs DEV`

### Staging
- Worker : `registre-erreurs-staging`
- D1 : `registre-erreurs-staging`
- R2 : `registre-erreurs-attachments-staging`
- Access : `Registre erreurs STAGING`

### Production
- Worker : `registre-erreurs`
- D1 : `registre-erreurs-prod`
- R2 : `registre-erreurs-attachments-prod`
- Access : `Registre erreurs`

## Bindings

- `DB`
- `ATTACHMENTS`
- `WRITE_RATE_LIMIT`
- `UPLOAD_RATE_LIMIT`

## Variables

- `APP_ENV`
- `BUSINESS_TIME_ZONE=America/Toronto`
- `MAX_ATTACHMENT_BYTES=10485760`
- `MAX_ATTACHMENTS_PER_ISSUE=10`
- `RECURRING_WINDOW_DAYS=90`
- `RECURRING_MIN_COUNT=3`
- `ACCESS_TEAM_DOMAIN`
- `ACCESS_AUD`

## Valeurs à injecter au provisioning

- Account ID;
- D1 database IDs;
- Access audience/domain;
- tokens/secrets;
- domaine production.

Ces valeurs ne modifient pas le contrat produit.

## Données

Dev/staging utilisent uniquement des données fictives jusqu'au gate confidentialité.
