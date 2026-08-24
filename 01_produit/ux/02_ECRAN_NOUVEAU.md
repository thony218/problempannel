# Écran Nouveau — spécification complète

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Objectif

Créer un dossier en moins d'une minute sans demander l'analyse complète.

## Wireframe mobile

```text
< Retour                         Nouveau cas

Quand est-ce arrivé ?
[ 24 août 2026 ]

Où ?
Succursale *
[ Ma succursale                v ]

Département
[ Mon département              v ]

Quel type de problème ?
Catégorie *
[ Choisir                      v ]

Sous-catégorie
[ Facultatif à cette étape     v ]

Que s'est-il passé ? *
[ Décrivez les faits...          ]
[                               ]

Conséquences *
[ ] Temps perdu
[ ] Retard client
[ ] Insatisfaction
[ ] Autre
...

Priorité *
(o) Normale
( ) Importante
( ) Urgente

Photos / documents
[ + Ajouter ]

[ Enregistrer le dossier ]
```

## Ordre exact

1. occurredOn
2. locationId
3. departmentId
4. categoryId
5. subcategoryId
6. description
7. impacts
8. priority
9. fichiers locaux

## Valeurs par défaut

- occurredOn = aujourd'hui dans America/Toronto.
- locationId = localisation par défaut de l'utilisateur si active.
- departmentId = département par défaut si actif.
- priority = normal.

## Sous-catégorie

Le libellé visible indique :
`Facultatif maintenant — sera confirmé à la prise en charge.`

## Impacts

Sélection multi.

Si `Aucun impact externe` est sélectionné :
- désélectionner les autres;
- désactiver les autres tant qu'il reste sélectionné.

Si `Autre` :
- afficher champ détails obligatoire.

## Pièces jointes avant création

Stockées dans le brouillon IndexedDB.
Après création du dossier :
1. POST issue;
2. upload des fichiers;
3. si un upload échoue, le dossier reste créé et affiche `1 fichier à réessayer`.

## Priorité urgente

Pas de modal supplémentaire. La friction doit rester faible.

## Sauvegarde du brouillon

Automatique dans IndexedDB.

Si un brouillon existe :
`Vous avez un brouillon commencé à 14:32. [Reprendre] [Supprimer]`

## Succès

Message :
`Dossier créé — No dossier : INC-000042.`

Puis ouverture du Détail.

## Validation visible

Sous le champ, pas en toast générique.

## Brouillons et uploads incomplets

L'écran Nouveau ne restaure que les enregistrements IndexedDB `state=editing`.

Un enregistrement `state=pendingUpload` correspond déjà à un dossier serveur et n'apparaît jamais ici.
