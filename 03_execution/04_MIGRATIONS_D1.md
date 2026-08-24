# Processus migrations D1

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable données**  
> Statut : **FROZEN**

## Règle principale

Une migration appliquée en production n'est jamais réécrite.

## Vérification

`npm run db:verify` doit :
1. créer un état local vierge;
2. appliquer toutes les migrations;
3. appliquer seed référence;
4. exécuter smoke queries;
5. retourner 0.

## Changements compatibles

Préférer expand/contract :

1. ajouter;
2. déployer code compatible;
3. migrer;
4. arrêter ancienne lecture/écriture;
5. supprimer plus tard.

## Migration destructive

RFC R2 obligatoire + backup + plan de récupération.
