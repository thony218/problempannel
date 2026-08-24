# Référentiels initiaux V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Produit**  
> Statut : **FROZEN**

## Localisations

Une localisation est obligatoire pour chaque dossier.

Deux catégories de valeurs :
1. succursales réelles;
2. `CORP` — Organisation / corporatif.

`CORP` est utilisé lorsque le problème concerne l'organisation au complet ou n'est pas attribuable à une succursale physique.

Les vraies succursales doivent être fournies au Bootstrap organisationnel.

## Départements

Globaux :
- sales
- service_repairs
- warehouse_inventory
- administration
- management
- route_installation
- other

Le couple location + département permet les analyses par site et par fonction.

## Catégories

- Ventes
- Employés — opération/formation
- Réparations
- Servex
- Achats et stock
- Garanties et retours
- Administration
- Communications entre succursales
- Expérience client

## Sous-catégories

Facultatives à la déclaration.
Obligatoires au triage avant de quitter `new`.

## Impacts

- aucun impact externe
- temps perdu
- retard client
- insatisfaction client
- perte financière
- mauvaise commande
- mauvais inventaire
- travail à refaire
- produit retourné
- autre
