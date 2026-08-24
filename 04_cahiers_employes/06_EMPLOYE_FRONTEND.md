# Employé 6 — Frontend

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable frontend**  
> Statut : **FROZEN**

## Mission
Implémenter React mobile-first sur types OpenAPI générés.

## Procédure
1. types générés;
2. mock temporaire si API absente;
3. brancher staging dès route réelle;
4. gérer error.code;
5. ETag/If-Match;
6. IndexedDB pour les brouillons Nouveau et les Blobs de fichiers;
7. tester 320/375/430.

## Interdit
D1 direct, snake_case, enums locaux, auth UI seule.

## Done
Aucun parcours terminé ne dépend du mock.

## Autorité UX V3

Implémenter exactement `01_produit/ux/`. Ne pas réinventer l'ordre des champs, les messages ou la navigation.
