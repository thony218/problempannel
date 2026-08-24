# Processus RFC et résolution par défaut

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## R0 — Locale et réversible

Exemples : nom fonction, découpage composant, refactor interne.

Autorité : propriétaire du module.

Action : décide, documente si non évident, continue.

## R1 — Structurante mais additive/réversible

Exemples : champ facultatif, endpoint additif, index, optimisation.

Autorité : propriétaire domaine + intégrateur.

Action :
1. RFC court;
2. impacts;
3. approbation par intégrateur;
4. contrats mis à jour;
5. implémentation.

Pas besoin du propriétaire du projet.

## R2 — Risquée/irréversible

- permissions/sécurité;
- migration destructive;
- exposition publique;
- rétention/confidentialité;
- nouvelle finalité de données;
- scope métier majeur;
- production.

Autorité : propriétaire du projet + domaine.

Seule la tâche touchée est bloquée. Le reste continue.

## En cas d'ambiguïté

1. Gel 0;
2. contrats;
3. classifier R0/R1/R2;
4. R0 : option la plus simple/réversible;
5. R1 : option additive/rétrocompatible;
6. R2 : bloquer seulement la tâche;
7. jamais coder un nouveau contrat partagé sans décision.
