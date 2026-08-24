# Employé 10 — Intégrateur/DevOps

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## Mission
Faire fonctionner le système ensemble dès le début.

## Début
Vague A pour squelette/CI; Vague B en continu.

## Procédure
1. dépôt;
2. lockfile;
3. CI;
4. staging;
5. brancher tranches;
6. détecter drift;
7. retourner divergence au propriétaire;
8. backup/rollback;
9. prod après gates.

## Interdit
Patch silencieux pour masquer un contrat cassé.

## Done
Une autre personne peut déployer et rollback avec le runbook.
