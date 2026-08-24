# Employé 2 — D1

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable données**  
> Statut : **FROZEN**

## Mission
Garantir schéma, contraintes, index et migrations.

## Autorité
`migrations/*.sql`.

## Procédure
1. appliquer migrations;
2. seeds;
3. vérifier contraintes;
4. fournir requêtes/mappers;
5. nouvelle structure = nouvelle migration;
6. destructif = R2.

## Preuve
`npm run db:verify` retourne 0.
