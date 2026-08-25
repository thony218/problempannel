# Dictionnaire de champs

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Produit + données**  
> Statut : **FROZEN**

## Issue

| UI | API | D1 | Type | Création | Résolution | Autorité |
|---|---|---|---|---|---|---|
| Numéro | publicId | dérivé de `id` | string | auto | — | serveur |
| Date incident | occurredOn | occurred_on | date | oui | oui | créateur si new; manager+ |
| Succursale | locationId | location_id | int|null | condition | oui* | créateur si new; manager+ |
| Département | departmentId | department_id | int|null | condition | oui* | créateur si new; manager+ |
| Catégorie | categoryId | category_id | int | oui | oui | créateur si new; manager+ |
| Sous-cat. | subcategoryId | subcategory_id | int|null | non | non | créateur si new; manager+ |
| Description | description | description | 10..5000 | oui | oui | créateur si new; manager+ |
| Priorité | priority | priority | enum | oui | oui | création; manager+ ensuite |
| Statut | status | status | enum | auto new | resolved | manager+ |
| Responsable | ownerUserId | owner_user_id | int|null | non | non | manager+ |
| Employé concerné par l'erreur | errorActorUserId | error_actor_user_id | int|null | non | non | manager+ |
| Échéance | dueDate | due_date | date|null | non | non | manager+ |
| Cause état | causeStatus | cause_status | enum|null | non | oui | manager+ |
| Cause | causeSummary | cause_summary | text|null | non | oui | manager+ |
| Solution immédiate | immediateSolution | immediate_solution | text|null | non | non | manager+ |
| Type correction | permanentCorrectionType | permanent_correction_type | enum|null | non | oui | manager+ |
| Correction | permanentCorrectionSummary | permanent_correction_summary | text|null | non | oui | manager+ |
| Attente type | waitingOn.type | waiting_on_type | enum|null | non | — | manager+ |
| Attente user | waitingOn.userId | waiting_on_user_id | int|null | non | — | manager+ |
| Attente label | waitingOn.label | waiting_on_label | text|null | non | — | manager+ |
| Résultat | finalResult | final_result | text|null | non | oui | manager+ |
| Prévention | preventionLearning | prevention_learning | text|null | non | oui | manager+ |
| Efficacité | effectivenessStatus | effectiveness_status | enum|null | non | oui | manager+ |
| Date revue | effectivenessReviewDate | effectiveness_review_date | date|null | non | si pending | manager+/serveur |
| Version | rowVersion | row_version | int | auto | — | serveur |

La localisation est obligatoire. La sous-catégorie reste facultative à la création, mais devient obligatoire avant toute sortie de `new`.

## Impacts

- impactTypeId requis;
- details 0..1000;
- `none_external` exclusif;
- `other` exige details.

## Commentaire

- body 1..4000;
- immutable;
- soft-delete manager/admin avec reason 5..500.

## Pièce jointe

- JPEG/PNG/WebP/HEIC/HEIF/PDF;
- 10 MiB max;
- 10 actives max/dossier;
- R2 privé.

## Action corrective

- title 3..200;
- description 0..3000;
- ownerUserId requis;
- dueDate requis;
- status;
- blocksIssueClosure;
- result;
- effectivenessStatus.
