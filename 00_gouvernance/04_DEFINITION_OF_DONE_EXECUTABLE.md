# Definition of Done exécutable

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur + QA**  
> Statut : **FROZEN**

## Preuve automatique

```bash
npm run verify
```

Code de sortie requis : `0`.

La commande couvre au minimum :
- lint contrat;
- génération types;
- typecheck;
- migrations sur base vierge;
- tests;
- build.

## Recette humaine séparée

- ergonomie téléphone;
- compréhension métier;
- confidentialité;
- GO production.

## Une tâche est Done si

- critère fonctionnel vrai;
- tests présents;
- verify vert;
- staging réel si parcours utilisateur;
- contrat respecté;
- handoff rempli;
- aucun mock restant sur le parcours;
- aucune dette temporaire cachée.
