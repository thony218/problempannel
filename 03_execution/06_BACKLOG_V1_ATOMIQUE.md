# Backlog V1 atomique

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Maître d'orchestre + intégrateur**  
> Statut : **FROZEN**

## Principe

Chaque tâche possède une sortie concrète et une preuve. Les tâches sont regroupées en tranches verticales.

| ID | Owner | Tâche | Dépend | Sortie | Preuve |
|---|---|---|---|---|---|
| FND-01 | 10 | Initialiser dépôt selon arborescence | — | dépôt Git | structure conforme |
| FND-02 | 10 | Installer dépendances + lockfile | FND-01 | package-lock | `npm ci` |
| FND-03 | 10 | Configurer Vite/Worker | FND-02 | configs | `npm run build` |
| FND-04 | 10 | Configurer tests Worker | FND-02 | vitest | health test vert |
| FND-05 | 10 | Configurer CI | FND-02 | workflow | CI verte |
| FND-06 | 4 | Linter OpenAPI | FND-02 | script | contract lint 0 |
| FND-07 | 4 | Générer types OpenAPI | FND-06 | types TS | aucun drift |
| FND-08 | 2 | Appliquer migration locale | FND-03 | D1 locale | db verify |
| FND-09 | 2 | Appliquer seeds | FND-08 | refs/dev | counts attendus |
| AUTH-01 | 3 | Middleware identité locale | FND-09 | auth dev | tests |
| AUTH-02 | 3 | Validation Cloudflare Access | AUTH-01 | auth réel | tests JWT |
| AUTH-03 | 3 | Lookup user actif/rôle | AUTH-01 | requireUser | inactive=403 |
| AUTH-04 | 3 | Helpers permissions | AUTH-03 | requireRole/policy | matrice tests |
| AUTH-05 | 4 | GET /me | AUTH-03 | endpoint | contract test |
| META-01 | 4 | GET /meta | FND-09 | endpoint | refs actifs |
| META-02 | 6 | Bootstrap session/meta UI | AUTH-05,META-01 | shell app | 401/403/loading |
| ISSUE-01 | 4 | Mapper D1↔API Issue | FND-08 | mapper | unit tests |
| ISSUE-02 | 4 | Générer publicId | ISSUE-01 | helper | year/id tests |
| ISSUE-03 | 4 | POST /issues | AUTH-04,ISSUE-02 | endpoint | S01-S03 |
| ISSUE-04 | 7 | Historique issue_created | ISSUE-03 | event | event test |
| ISSUE-05 | 6 | Formulaire Nouveau mobile | META-02 | UI | 320 px |
| ISSUE-06 | 6 | Brouillon IndexedDB champs + fichiers | ISSUE-05 | service draft | S23-S25 |
| ISSUE-07 | 6 | Brancher création staging | ISSUE-03,ISSUE-05 | tranche intégrée | E2E création |
| LIST-01 | 4 | Pagination curseur | ISSUE-03 | helper | tests cursor |
| LIST-02 | 4 | GET /issues + filtres | LIST-01 | endpoint | filtres/pagination |
| LIST-03 | 4 | Recherche q | LIST-02 | recherche | limites/escaping |
| LIST-04 | 6 | Registre mobile + filtres | LIST-02 | UI | empty/error/loading |
| DETAIL-01 | 4 | GET issue + ETag | ISSUE-03 | endpoint | ETag attendu |
| DETAIL-02 | 6 | Détail lecture | DETAIL-01 | UI | mobile |
| FLOW-01 | 4 | PATCH If-Match/version | DETAIL-01 | endpoint | 409/428 |
| FLOW-02 | 4 | Matrice transitions | FLOW-01 | service domaine | 16 cellules |
| FLOW-03 | 4 | Validation résolution/reviewDate | FLOW-02 | règles | S08-S10 |
| FLOW-04 | 4 | Réouverture/historique | FLOW-02 | règle | S11 |
| FLOW-05 | 6 | UI prise en charge | FLOW-01 | sections edit | permissions |
| FLOW-06 | 6 | UI conflit 409 | FLOW-01 | dialogue | S12 |
| COM-01 | 7 | GET/POST commentaires | DETAIL-01 | endpoints | validation |
| COM-02 | 7 | Soft-delete commentaire | COM-01 | endpoint | reason+role |
| COM-03 | 6 | UI commentaires | COM-01 | UI | staging |
| ATT-01 | 7 | Upload multipart→R2 | DETAIL-01 | endpoint | MIME/size/count |
| ATT-02 | 7 | List/download/delete PJ | ATT-01 | endpoints | auth+soft delete |
| ATT-03 | 6 | UI pièces jointes mobile | ATT-01 | UI | photo/PDF |
| ACT-01 | 7 | GET/POST actions correctives | DETAIL-01 | endpoints | role tests |
| ACT-02 | 7 | PATCH action + owner subset | ACT-01 | endpoint | permission |
| ACT-03 | 6 | UI actions correctives | ACT-02 | UI | role-aware |
| HIST-01 | 7 | GET historique curseur | DETAIL-01 | endpoint | append-only |
| HIST-02 | 6 | Timeline historique | HIST-01 | UI | lisible |
| LINK-01 | 8 | GET/POST/DELETE similar | DETAIL-01 | endpoints | paire unique |
| ANA-01 | 8 | Dataset analytics déterministe | FND-08 | fixtures | résultats manuels |
| ANA-02 | 8 | KPI summary/effectiveness | ANA-01 | SQL | exact |
| ANA-03 | 8 | Récurrence 3/90 | ANA-01 | SQL | S23/S24 |
| ANA-04 | 4 | Endpoints analytics | ANA-02,ANA-03 | API | contract tests |
| ANA-05 | 6 | UI Analyse mobile | ANA-04 | UI | filtres |
| ADM-01 | 3 | Admin users | AUTH-04 | endpoints | admin-only |
| ADM-02 | 4 | Admin référentiels | AUTH-04 | endpoints | active flag |
| ADM-03 | 6 | UI Administration | ADM-01,ADM-02 | UI | admin-only |
| QA-01 | 9 | Matrice permissions API | modules | tests | toutes cellules |
| QA-02 | 9 | Matrice transitions API | FLOW-02 | tests | 16 cellules |
| QA-03 | 9 | Tests fichiers/R2 | ATT-* | tests | limites/auth |
| QA-04 | 9 | E2E parcours complet | core | Playwright | vert |
| QA-05 | 9 | Tests mobile 320/375/430 | UI | rapport | aucun blocage |
| OPS-01 | 10 | Provisionner staging | FND-* | D1/R2/Worker | deploy |
| OPS-02 | 10 | Configurer Access staging | OPS-01 | Access | login réel |
| OPS-03 | 10 | Logs/requestId/rate limit | backend | observabilité | tests |
| OPS-04 | 10 | Backup/restore test | OPS-01 | runbook | restore prouvé |
| OPS-05 | 10 | Gate confidentialité | avant prod | approbation R2 | documentée |
| OPS-06 | 9 | Recette finale | tous | GO/NO-GO | rapport |
| OPS-07 | 10 | Déploiement production | OPS-05,OPS-06 | release | smoke tests |

## Taille

60 tâches atomiques environ. Si une tâche grossit au point de toucher plusieurs contrats ou de dépasser une tranche raisonnable, elle doit être redécoupée avant développement.


## Bloc V3 — Prérequis supplémentaires avant Vague B

| ID | Owner | Tâche | Sortie | Preuve |
|---|---|---|---|---|
| V3-BOOT-01 | 10 | Générer et committer package-lock | lockfile | `npm ci` passe |
| V3-BOOT-02 | 10 | Faire passer CI réelle une fois | run vert | CI success |
| V3-INF-01 | 10 | Séparer les tsconfig | 3 configs | typecheck vert |
| V3-INF-02 | 9 | Appliquer D1 via Vitest Cloudflare | setup/test | db test vert |
| V3-MOB-01 | 6 | Brouillon IndexedDB champs+Blob | service draft | scénario réseau/photo |
| V3-ANA-01 | 4 | Ajouter filtre review due | API | contrat test |
| V3-ANA-02 | 8 | Ajouter vue Révisions dues | analytics/UI | scénario due |
| V3-FILE-01 | 7 | Accepter HEIC/HEIF | upload | fichier iPhone test |
| V3-ADM-01 | 4 | Remplacer admin générique | routes typées | OpenAPI/type tests |
| V3-PRIV-01 | 7 | Implémenter caviardage | endpoint | valeurs libres absentes historique |
| V4-ID-01 | 4 | Résoudre `INC-{id}` strictement | resolver | format invalide=404 |
| V3-WAIT-01 | 4 | Enforcer waiting objet | Zod + DB | supplier sans label refusé |
| V3-KPI-01 | 8 | Implémenter définitions KPI V3 | SQL | dataset exact |
| V3-SCOPE-01 | 4 | Rendre location obligatoire | API/DB | création sans location=422 |
| V3-TRIAGE-01 | 4 | Sous-cat obligatoire sortie new | domaine | transition refusée sans sous-cat |
| V3-REC-01 | 8 | Récurrence local+organisation | SQL/API | deux scopes testés |
| V3-OWNER-01 | 3/4 | Owner peut inProgress↔waiting | policy | matrice permissions |
| V3-UX-01 | 5 | Valider Gel 0 UX | specs | aucun champ à deviner |
| V3-UX-02 | 6 | Implémenter Nouveau selon spec | UI | test parcours |
| V3-UX-03 | 6 | Implémenter Registre selon spec | UI | états/filtres |
| V3-UX-04 | 6 | Implémenter Détail selon spec | UI | roles/409 |

## Fermeture V4

| ID | Owner | Tâche | Sortie | Preuve |
|---|---|---|---|---|

| V4-E2E-01 | 9/10 | Isoler Playwright dans tests/e2e | config + smoke test | collecte correcte |
| V4-RED-01 | 4/7 | Refuser caviardage sans cible | OpenAPI + Zod | S43-S44 |
| V4-DRAFT-01 | 6 | Machine d'état editing/pendingUpload | IndexedDB | S45-S47 |
| V4-IMG-01 | 6 | Réduction images décodables | frontend helper | S50 |

## Complétion V5 — Attribution et fermeture locale

| ID | Owner | Tâche | Sortie | Preuve |
|---|---|---|---|---|
| V5-ATTR-01 | 2/4 | Champ employé concerné + migration | D1/OpenAPI | migration + types |
| V5-ATTR-02 | 3/4 | Permissions et historique attribution | service PATCH | S53-S55 |
| V5-ATTR-03 | 6 | Annuaire minimal et UI attribution | meta/détail/registre | aucun courriel |
| V5-ATTR-04 | 8/6 | Analytique erreurs par employé | API/UI | S56 |
| V5-CLOSE-01 | 4/6 | ETag HTTP conforme + repli client | Worker/UI | PATCH réel |
| V5-CLOSE-02 | 4/6 | Accueil et tris Registre | routes/UI/API | S41 + tris |
| V5-CLOSE-03 | 7 | Quota PJ atomique | trigger/service | concurrence prouvée |
