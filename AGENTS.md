# Règles de travail des agents

Ce fichier s'applique à tout le dépôt. Tout agent doit le lire intégralement avant d'analyser ou de modifier le projet.

## Langue et communication

- Travailler et communiquer en français.
- Donner des constats précis, vérifiables et reliés aux fichiers ou aux commandes exécutées.
- Ne jamais présenter une validation locale comme une preuve de CI, de staging ou de production.
- Signaler clairement les hypothèses, blocages, limitations et validations non exécutées.

## Sauvegarde obligatoire

- Avant toute modification du dépôt, créer une sauvegarde dans `/Users/anthobruneau/Downloads/Back up Codex`.
- Nommer la sauvegarde avec le nom du projet, la date et le but de l'intervention.
- Une analyse strictement en lecture seule ne nécessite pas de sauvegarde.
- Ne jamais supprimer ou remplacer une sauvegarde existante.

## Respect de la demande

- Respecter exactement le périmètre demandé par l'utilisateur.
- Une demande d'analyse, d'audit, de diagnostic ou de revue est strictement en lecture seule.
- Ne pas modifier, reformater, migrer, déployer, committer ou pousser sans autorisation explicite.
- Ne pas corriger un problème découvert hors périmètre. Le documenter et demander l'autorisation avant d'agir.
- Ne jamais modifier plusieurs sujets sous prétexte de « nettoyage ».

## Avant de commencer

1. Lire `AGENTS.md`.
2. Lire `JOURNAL_TRAVAIL.md`, en particulier l'état global et la dernière entrée.
3. Lire la tâche correspondante dans `03_execution/06_BACKLOG_V1_ATOMIQUE.md`.
4. Lire uniquement les contrats et spécifications nécessaires dans `00_gouvernance`, `01_produit`, `02_contrats` et `05_qualite_exploitation`.
5. Vérifier `git status --short --branch` et préserver toutes les modifications existantes.
6. Identifier les dépendances, la preuve attendue et les fichiers qui seront touchés.
7. Créer la sauvegarde obligatoire avant la première écriture.

## Sources d'autorité

En cas de contradiction, utiliser cet ordre :

1. demande explicite actuelle de l'utilisateur;
2. `AGENTS.md`;
3. décisions gelées dans `00_gouvernance`;
4. contrats dans `01_produit` et `02_contrats`;
5. backlog dans `03_execution/06_BACKLOG_V1_ATOMIQUE.md`;
6. journal de travail;
7. code existant.

Ne pas modifier un contrat gelé silencieusement. Si une modification de contrat est nécessaire, ouvrir ou proposer un RFC selon `00_gouvernance/03_PROCESSUS_RFC_RESOLUTION_DEFAUT.md`.

## Coordination entre agents

- Un seul agent est propriétaire d'une tâche et de ses fichiers à un moment donné.
- Avant de déléguer, fournir à l'autre agent : l'ID de tâche, le périmètre, les fichiers autorisés, les dépendances, les critères d'acceptation et les validations attendues.
- Découper le travail selon les tâches atomiques du backlog; ne pas créer de lots vagues.
- Ne pas faire travailler deux agents simultanément sur le même fichier.
- Ne pas annuler, écraser ou reformater le travail d'un autre agent.
- Si des changements concurrents apparaissent, arrêter l'écriture, conserver les deux travaux et signaler le conflit.
- Un agent délégué ne committe, ne pousse et ne déploie que si cette action lui a été explicitement confiée.
- L'agent intégrateur relit les différences, exécute les validations et confirme la cohérence du lot avant de déclarer la tâche terminée.

## Règles techniques

- Utiliser Node.js 24, conformément à `.nvmrc` et `package.json`.
- Utiliser `npm ci` quand le lockfile ne doit pas changer; utiliser `npm install` seulement si une modification de dépendances est autorisée.
- Les types OpenAPI sont générés depuis `contracts/openapi.yaml`; ne pas créer une seconde définition manuelle concurrente.
- Toute permission doit être appliquée côté serveur, même si l'interface masque aussi l'action.
- Toute écriture métier doit respecter les contrôles de concurrence, les permissions, l'historique et les invariants D1.
- Ne pas supposer qu'un comportement SQLite/D1 est atomique : le prouver par un test adapté.
- Ne jamais exposer un bucket R2 publiquement ni enregistrer de secret, jeton ou donnée sensible dans Git, les journaux ou les messages.
- Les données réelles sont interdites avant l'approbation du gate de confidentialité.

## Modification et qualité

- Faire le plus petit changement cohérent qui satisfait entièrement la tâche.
- Conserver les conventions et l'architecture existantes.
- Ajouter ou mettre à jour les tests correspondant au comportement modifié.
- Pour une tranche verticale, couvrir selon le besoin : migration, accès D1, domaine, API, interface, tests et vérification mobile.
- Ne pas utiliser un écran fonctionnant seulement avec des mocks comme preuve de fin.
- Ne pas masquer une dette avec un commentaire temporaire; la rattacher à une tâche du backlog ou la signaler.

## Validations attendues

Pour une modification de code, exécuter les validations pertinentes, puis idéalement :

```bash
npm run verify
```

Selon le périmètre, ajouter :

```bash
npm run test:e2e
git diff --check
```

- Ne jamais déclarer un test réussi s'il n'a pas été exécuté dans l'intervention courante.
- Si une validation ne peut pas être exécutée, indiquer exactement laquelle et pourquoi.
- Vérifier une interface importante dans les dimensions mobiles prévues : 320, 375 et 430 pixels.

## Git, CI et déploiement

- Ne jamais utiliser de commande destructive comme `git reset --hard` ou écraser des changements locaux.
- Ne pas committer, pousser, créer une branche distante ou déployer sans demande explicite.
- Un commit local n'est pas une publication GitHub.
- Une configuration CI présente n'est pas une CI verte tant qu'un run distant réussi n'est pas observé.
- Un déploiement Cloudflare n'est prouvé que par la version déployée, l'URL attendue et des vérifications authentifiées.
- Avant staging ou production, suivre `05_qualite_exploitation/03_CHECKLIST_RELEASE.md` et `05_qualite_exploitation/07_GATE_CONFIDENTIALITE_AVANT_PROD.md`.

## Journal et transmission

Après une tâche autorisée et réellement terminée, ajouter une entrée append-only dans `JOURNAL_TRAVAIL.md` contenant :

- IDs de tâches;
- date et propriétaire;
- fichiers modifiés;
- commandes et résultats;
- statut de `npm run verify`;
- statut du test staging;
- limitations ou dette;
- RFC éventuelle;
- prochaine tâche recommandée.

Ne jamais réécrire une ancienne entrée du journal. Toute correction doit être une nouvelle entrée.

## Critère de fin

Une tâche est terminée seulement si :

- son périmètre et ses critères d'acceptation sont satisfaits;
- les permissions et invariants sont appliqués côté serveur;
- les tests pertinents sont présents et réussissent;
- le diff est limité au périmètre autorisé;
- les validations et limitations sont rapportées honnêtement;
- le journal est mis à jour lorsque la demande autorise cette modification.
