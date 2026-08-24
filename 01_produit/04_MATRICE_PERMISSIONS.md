# Matrice exhaustive des permissions V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Sécurité**  
> Statut : **FROZEN**

| Action | employee | manager | admin | Condition |
|---|---:|---:|---:|---|
| Lire issue | oui | oui | oui | actif |
| Créer issue | oui | oui | oui | — |
| Corriger son issue | oui | oui | oui | employee: créateur + new |
| Changer priorité | non | oui | oui | — |
| Assigner owner | non | oui | oui | — |
| Changer dueDate | non | oui | oui | — |
| new → autre | non | oui | oui | sous-catégorie requise |
| inProgress ↔ waiting | oui | oui | oui | employee seulement si owner |
| Résoudre | non | oui | oui | préconditions |
| Réouvrir | non | oui | oui | reopenReason |
| Éditer cause/correction/résultat | non | oui | oui | — |
| Évaluer efficacité | non | oui | oui | — |
| Commenter | oui | oui | oui | — |
| Soft-delete commentaire | non | oui | oui | raison |
| Ajouter PJ | oui | oui | oui | limites |
| Soft-delete PJ | non | oui | oui | — |
| Créer/assigner action | non | oui | oui | — |
| Modifier sa propre action | oui | oui | oui | employee: status/result |
| Lier similar | non | oui | oui | — |
| Analytics générales | oui | oui | oui | — |
| Charge par responsable | non | oui | oui | — |
| Gérer users/référentiels | non | non | oui | — |
| Caviarder | non | non | oui | procédure R2 |
| Hard-delete issue | non | non | non | hors V1 |
