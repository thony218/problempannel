# Décisions arrêtées — Gel 0 V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Maître d'orchestre**  
> Statut : **FROZEN**

## Décisions structurantes V1

| Réf | Décision arrêtée |
|---|---|
| D-01 | IDs D1 = INTEGER AUTOINCREMENT |
| D-02 | JSON invalide = 400; validation métier = 422 |
| D-03 | concurrence = rowVersion + ETag/If-Match; stale=409; If-Match absent=428 |
| D-04 | inexistant=404; permission insuffisante=403 |
| D-05 | sortie de waiting efface l'attente active; historique la conserve |
| D-06 | **locationId obligatoire sur tous les dossiers** |
| D-07 | subcategoryId facultatif à la déclaration, **obligatoire avant de quitter new** |
| D-08 | waitingOn structuré user/customer/supplier/other avec objet obligatoire |
| D-09 | impacts structurés; noneExternal exclusif |
| D-10 | pagination curseur, 25 défaut, 100 max |
| D-11 | PJ JPEG/PNG/WebP/HEIC/HEIF/PDF; 10 MiB; 10 actives max |
| D-12 | upload multipart vers Worker puis R2 |
| D-13 | writes 120/min/user; uploads 20/min/user |
| D-14 | fuseau métier America/Toronto; timestamps UTC |
| D-15 | publicId = `INC-{id global sur au moins 6 chiffres}`; aucun composant année |
| D-16 | récurrence = même sous-catégorie ≥3/90j, calculée localement ET organisation |
| D-17 | lien similar non orienté, une ligne ordonnée |
| D-18 | commentaires immuables; soft-delete manager/admin avec raison |
| D-19 | stack Node/npm/TypeScript/React/Vite/Hono/Zod/OpenAPI/Vitest/Playwright |
| D-20 | dépôt full-stack unique |
| D-21 | brouillons Nouveau dans IndexedDB; pas de background sync V1 |
| D-22 | capacité cible 100 users, 5k issues/an, 100k issues historiques |
| D-23 | navigateurs actuel+précédent Chrome/Edge/Safari/Firefox + mobile |
| D-24 | données réelles exigent gate confidentialité/rétention |
| D-25 | users/référentiels via endpoints admin typés |
| D-26 | détail issue cœur+impacts+actions; collaboration via routes dédiées |
| D-27 | aucune durée de rétention inventée avant approbation |
| D-28 | contrats/docs versionnés Git |
| D-29 | pending à résolution → reviewDate défaut +30 jours |
| D-30 | reopenReason dans historique, pas dans issues |
| D-31 | triage initial, résolution et réouverture = manager/admin |
| D-32 | employee corrige son issue seulement tant qu'elle est new |
| D-33 | owner d'action peut modifier status/result de son action |
| D-34 | aucun hard-delete issue |
| D-35 | catégorie Employés = opération/formation, pas disciplinaire/médical |
| D-36 | owner du dossier peut faire inProgress ↔ waiting une fois assigné |
| D-37 | supprimée en V4 : l'ancienne composante année n'existe plus; l'année n'est pas une composante d'identité |
| D-38 | résolution d'un publicId = parsing strict du suffixe numérique global |
| D-39 | efficacité dashboard = `issues.effectiveness_status` uniquement |
| D-40 | averageResolutionHours = moyenne heures calendaires `resolvedAt-createdAt` |
| D-41 | révisions d'efficacité accessibles via filtre `effectivenessReviewDueBefore` |
| D-42 | HEIC/HEIF stockés tels quels; aperçu générique si navigateur ne sait pas les afficher |
| D-43 | mécanisme de caviardage réservé dès V1; historique n'enregistre jamais l'ancienne valeur des textes libres |
| D-44 | types OpenAPI générés au verify et non commités |
| D-45 | navigation mobile primaire = Accueil / Registre / Nouveau / Analyse |
| D-46 | Admin et Détail sont des écrans secondaires, pas des destinations primaires |
| D-47 | une localisation spéciale `CORP` représente les enjeux organisationnels sans succursale physique |
| D-48 | une sous-catégorie doit être choisie au triage pour rendre la récurrence fiable |

## Autorité de changement

- décision locale/réversible : R0;
- additive/structurante : R1;
- sécurité, confidentialité, destructif, production : R2.

| D-49 | un caviardage exige au moins une cible non vide |
| D-50 | brouillon mobile = `editing` ou `pendingUpload`; seul `editing` apparaît dans Nouveau |
| D-51 | les images décodables sont redimensionnées côté client avant upload |
| D-52 | CI utilise uniquement `npm ci`; absence de lockfile = Bootstrap 0 incomplet |
