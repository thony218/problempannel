# Journal de travail

> Propriétaire courant : voir dernière entrée.
> But : permettre à n'importe quel prochain worker (humain ou agent) de reprendre exactement où le précédent s'est arrêté, sans relire toute la conversation qui a précédé.

## Comment utiliser ce journal

- **Avant de commencer** : lis la dernière entrée (en bas du fichier, ordre chronologique). Elle indique le "Prochain propriétaire" et les tâches suivantes suggérées.
- **Une entrée par tâche terminée** (ou par lot cohérent de tâches liées), au moment du commit correspondant.
- **Ne jamais** remplacer ou réécrire une entrée passée. Corriger une erreur = nouvelle entrée qui l'annule/la précise, jamais une réécriture silencieuse (cf. `G-007` historique append-only, même esprit appliqué ici).
- Champs obligatoires par entrée, calqués sur `05_qualite_exploitation/06_MODELE_HANDOFF.md` :
  1. Task IDs (référence `03_execution/06_BACKLOG_V1_ATOMIQUE.md`)
  2. Date
  3. Owner
  4. Commit(s)
  5. Fichiers produits/modifiés
  6. Commandes exécutées + résultat
  7. `npm run verify` : PASS/FAIL (coller le résumé si FAIL)
  8. Staging testé : oui/non
  9. Limitations connues / dette
  10. RFC ouverte : oui/non (lien si oui)
  11. Prochain propriétaire + tâches suivantes suggérées

Un simple « fini » n'est pas une entrée valide (cf. `03_execution/02_HANDOFFS.md`).

---

## État global

| Vague | Statut |
|---|---|
| Bootstrap 0 | EN COURS |
| Vague A — Fondations | NON DÉMARRÉE |
| Vague B — Tranches verticales | NON DÉMARRÉE |
| Vague C | NON DÉMARRÉE |
| Vague D | NON DÉMARRÉE |

---

## Entrées

### 2026-08-24 — Bootstrap 0 : init dépôt

- **Task IDs** : FND-01 (Initialiser dépôt selon arborescence)
- **Date** : 2026-08-24
- **Owner** : Intégrateur (agent)
- **Commit(s)** : (à venir dans ce commit — voir message de commit associé)
- **Fichiers produits/modifiés** : `.git/` initialisé sur `main`; ajout de `JOURNAL_TRAVAIL.md` (ce fichier).
- **Commandes exécutées** :
  - `git init -b main` → OK
  - `git config user.email/user.name` (identité locale au dépôt, aucune config globale trouvée)
- **`npm run verify`** : pas encore exécuté (dépendances pas installées)
- **Staging testé** : non
- **Limitations connues** : aucun remote Git configuré (pas d'URL fournie par l'utilisateur). Tout reste local pour l'instant.
- **RFC ouverte** : non
- **Prochain propriétaire** : Intégrateur (agent), suite immédiate = FND-02 (npm install + lockfile) dans ce même passage.

---
