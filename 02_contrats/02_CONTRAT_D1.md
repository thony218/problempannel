# Contrat D1 V4

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable données**  
> Statut : **FROZEN**

## Autorité exécutable

`migrations/0001_core.sql`

## Identifiants

Toutes les tables principales :

```sql
INTEGER PRIMARY KEY AUTOINCREMENT
```

## No dossier

Aucune colonne `public_id`.

Le backend transforme :

```text
id = 42
→ INC-000042
```

Le publicId ne contient ni année ni compteur secondaire.

## Tables

- locations
- departments
- categories
- subcategories
- impact_types
- users
- issues
- issue_impacts
- corrective_actions
- comments
- attachments
- issue_history
- issue_links
- system_audit

## Concurrence

`issues.row_version` commence à 1.

PATCH :
- compare l'ETag connu;
- UPDATE conditionnel sur `row_version`;
- incrémente la version;
- 0 ligne = 409.

## Règles protégées en D1

- `location_id` obligatoire;
- un dossier non `new` exige `subcategory_id`;
- `waiting` exige un objet d'attente complet;
- hors `waiting`, les champs d'attente doivent être nuls;
- caviardage exige acteur + date + raison.

## Mutations multi-tables

Utiliser des opérations D1 transactionnelles/batch lorsque la cohérence l'exige.

## Historique

Append-only pour les événements.

Les textes libres modifiés ne sont jamais recopiés dans `payload_json`.

## Migrations

Ne jamais réécrire une migration déjà appliquée en production.
