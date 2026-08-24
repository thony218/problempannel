# Registre des erreurs — Paquet d'orchestration V4

La V4 ferme les derniers points concrets des deux contre-audits indépendants.

## Changements majeurs V4

- Playwright isolé dans `tests/e2e`.
- Vitest exclut explicitement les E2E.
- `RedactIssueRequest` exige au moins une cible non vide.
- Brouillons IndexedDB avec états `editing` / `pendingUpload`.
- Optimisation d'image côté client documentée.
- Arborescence documentée = arborescence réellement livrée.
- CI sans repli `npm install --ignore-scripts`.
- **Numéro public simplifié à `INC-000042`**.

## Pourquoi le numéro change

L'ancien format avec année intégrée pouvait être interprété comme un compteur annuel.

V4 utilise :

```text
INC-000042
```

Le suffixe est simplement l'identifiant global du dossier. L'année de création reste une donnée normale du dossier, pas une partie de son identifiant.

Cela supprime complètement :
- l'ambiguïté annuelle;
- l'ancienne règle d'année de dossier;
- le risque de deux URLs avec des années différentes;
- une décision applicative inutile.

## Bootstrap 0 restant

La seule étape majeure qui dépend encore d'un environnement npm réel :

```bash
npm install
npm run verify
npm run test:e2e:install
npm run test:e2e
```

Puis :
- committer `package-lock.json`;
- pousser sur `main`;
- vérifier une CI verte.

Aucun travail parallèle ne démarre avant ce point.
