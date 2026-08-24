# Exigences non fonctionnelles V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Architecture + QA**  
> Statut : **FROZEN**

## Volumétrie
100 utilisateurs, 5 000 issues/an, 100 000 issues historiques.

## Performance p95 staging
- me ≤500 ms
- liste/détail ≤750 ms
- écritures ≤1 000 ms
- analytics ≤2 000 ms

## Temps
Fuseau métier America/Toronto.
Timestamps UTC.
Dates d'échéance civiles.

## Réseau dégradé
Application en ligne, mais Nouveau utilise IndexedDB :
- champs + Blobs;
- survit éviction onglet;
- aucune soumission background;
- suppression après succès;
- reprise/suppression proposée après 24 h.

## Pièces jointes
10 MiB max, 10 actives.
HEIC/HEIF acceptés côté serveur.
Si le navigateur ne peut pas prévisualiser : icône fichier + nom + taille.

## Confidentialité
Les historiques de changements de textes libres ne conservent pas `oldValue` ni `newValue`.
Ils conservent `fieldName` + type d'événement.

## Navigateurs
Actuel + précédent : Chrome, Edge, Safari, Firefox; Safari iOS et Chrome Android.

## Accessibilité
WCAG 2.1 AA visé pour parcours principaux.
