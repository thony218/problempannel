# RFC-2026-001 — Attribution d'un dossier à l'employé concerné par l'erreur

> Date : **2026-08-25**
> Classe : **R2 — nouvelle finalité de donnée liée à un employé**
> Statut : **ACCEPTÉE**
> Autorité : demande explicite du propriétaire du projet le 2026-08-25

## Problème

Le champ existant `ownerUserId` désigne la personne chargée de corriger le
dossier. Il ne permet pas de savoir quel employé est associé à l'erreur ni de
mesurer quels types d'erreurs reviennent par employé. Réutiliser ce champ
mélangerait responsabilité de traitement et attribution de l'événement.

## Décision

- Ajouter `issues.error_actor_user_id`, nullable et référencé vers `users.id`.
- Exposer le champ API `errorActorUserId` sur un dossier.
- Réserver son écriture aux rôles `manager` et `admin`.
- Publier dans `/meta` un annuaire interne minimal sans courriel : `id`,
  `displayName`, `role`, `active`.
- Ajouter un filtre de registre par employé concerné.
- Ajouter une analytique protégée `errors-by-employee`, groupée par employé et
  sous-catégorie, accessible seulement aux gestionnaires et administrateurs.
- Conserver les attributions historiques lorsqu'un utilisateur devient inactif.

## Garde-fous

- Le champ demeure facultatif : aucune attribution n'est inventée pour les
  dossiers existants ou lorsqu'elle est inconnue.
- Le créateur d'un dossier de rôle `employee` ne peut pas attribuer l'erreur à
  un collègue.
- Les courriels ne sont jamais exposés dans l'annuaire ni l'analytique.
- L'usage demeure opérationnel et de formation, conformément à D-35; aucune
  donnée médicale, disciplinaire ou autre texte libre sur l'employé n'est
  ajouté.
- Chaque modification du champ passe par `If-Match`, incrémente `rowVersion` et
  est inscrite dans l'historique sous forme structurelle, sans ancienne valeur.

## Compatibilité et migration

La migration est additive et rétrocompatible. Les lignes existantes reçoivent
`NULL`. La suppression ou la désactivation d'un utilisateur n'efface pas son
nom historique de l'annuaire interne tant que la ligne `users` existe.

## Preuves attendues

- migration D1 locale sur base vierge;
- permissions API employee=403, manager/admin=200;
- référence inactive ou inconnue=422;
- filtre par employé et agrégation employé+sous-catégorie exacts;
- interface d'édition, détail, registre et analytique vérifiée sur mobile;
- `npm run verify`, Playwright et `git diff --check` verts.
