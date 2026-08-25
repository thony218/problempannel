# Définitions analytiques et KPI

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable analytique**  
> Statut : **FROZEN**

## Source des KPI

### Efficacité du dossier
Source unique : `issues.effectiveness_status`.

`corrective_actions.effectiveness_status` sert seulement à l'analyse détaillée des actions; il n'alimente pas le taux principal V1.

### effectivenessRate

```text
effective / (effective + ineffective)
```

`pending` est affiché séparément et exclu du dénominateur.

### averageResolutionHours

Moyenne des heures **calendaires** :

```text
resolved_at - created_at
```

pour les dossiers résolus dans la période filtrée.

Ce KPI ne part pas de `occurred_on`.

### Dossier en retard

`due_date < date métier courante`
et `status != resolved`.

### Révision d'efficacité due

`effectiveness_status = pending`
et `effectiveness_review_date <= date demandée`.

### Récurrence locale

Groupe :
`location_id + subcategory_id`

Seuil :
≥3 dossiers sur 90 jours.

### Récurrence organisation

Groupe :
`subcategory_id`

Seuil :
≥3 dossiers sur 90 jours.

Le dashboard doit distinguer visuellement les deux types.

## Erreurs par employé

Source : `issues.error_actor_user_id`.

Groupe :
`error_actor_user_id + subcategory_id`.

Seuls les dossiers portant une attribution et une sous-catégorie sont inclus.
La vue est réservée aux gestionnaires et administrateurs. Elle publie le nom
affiché, le statut actif/inactif, la sous-catégorie, le nombre de dossiers et
le dossier le plus récent; jamais le courriel ni un texte libre.
