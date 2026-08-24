# Intégration continue

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## But

Éviter le Big Bang.

## Tranche verticale type

Exemple création issue :

1. OpenAPI;
2. migration si besoin;
3. route API;
4. règle métier;
5. historique;
6. UI;
7. API réelle staging;
8. tests;
9. handoff.

## Mock

Dès qu'une route staging existe, le parcours utilise l'API réelle.

## Intégrateur

Dès Vague B :
- surveille CI;
- met à jour staging;
- détecte drift;
- renvoie divergence au propriétaire;
- n'ajoute pas de patch silencieux.
