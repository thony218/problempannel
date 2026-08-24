# Matrice exhaustive des transitions V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Produit + backend**  
> Statut : **FROZEN**

Tout non explicitement autorisé = `INVALID_STATUS_TRANSITION`.

| De \ Vers | new | inProgress | waiting | resolved |
|---|---|---|---|---|
| new | N/A | manager/admin | manager/admin | manager/admin |
| inProgress | interdit | N/A | manager/admin **ou owner** | manager/admin |
| waiting | interdit | manager/admin **ou owner** | N/A | manager/admin |
| resolved | interdit | manager/admin | interdit | N/A |

## Préconditions

### Toute sortie de `new`
- subcategoryId obligatoire.

### → waiting
- waitingOn valide;
- si acteur employee : il doit être owner du dossier.

### waiting → inProgress
- acteur manager/admin ou owner;
- champs waiting actifs mis à null;
- historique conserve l'attente précédente.

### → resolved
- manager/admin;
- champs de résolution complets;
- aucune action bloquante ouverte.

### resolved → inProgress
- manager/admin;
- reopenReason requis;
- événement historique.
