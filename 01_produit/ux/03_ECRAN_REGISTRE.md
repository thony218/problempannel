# Écran Registre — spécification complète

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Wireframe mobile

```text
Registre
[ Rechercher un no ou un mot... ]

[ Filtres 3 ]   [ Trier v ]

[ Urgent x ] [ Montréal x ] [ En cours x ]

INC-000042       URGENT
Erreur de réception
Montréal · Achats et stock
En cours · Responsable : Marie
Échéance : aujourd'hui
--------------------------------
...
```

## Recherche

Placeholder :
`No dossier ou mots-clés`

Déclenchement :
- 2 caractères minimum;
- debounce 300 ms.

## Filtres

Ordre :
1. statut;
2. priorité;
3. localisation;
4. département;
5. catégorie;
6. sous-catégorie;
7. responsable;
8. date;
9. en retard;
10. efficacité;
11. révision due.

## Tri

Défaut :
`Plus récents`

Options V1 :
- plus récents;
- plus anciens;
- priorité;
- échéance.

## Carte dossier

Toujours afficher :
- publicId;
- description tronquée 2 lignes;
- priorité;
- status;
- location;
- catégorie;
- owner ou `Non assigné`;
- dueDate si présente.

## États

### Vide sans filtre
`Aucun dossier n'a encore été créé.`  
CTA : `Signaler un problème`

### Vide avec filtres
`Aucun dossier ne correspond à ces filtres.`  
CTA : `Réinitialiser les filtres`

### Fin de pagination
Aucun CTA; simple fin de liste.

## Mes dossiers

Ce n'est pas un écran distinct techniquement :
Registre avec `ownerUserId=me`, titre `Mes dossiers`.
