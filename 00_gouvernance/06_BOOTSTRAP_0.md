# Bootstrap 0 réel

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **PRE-WAVE-A**

## Étapes obligatoires avant branches parallèles

1. Initialiser Git.
2. Vérifier Node 24.
3. Vérifier `wrangler.jsonc` local.
4. Exécuter :
   ```bash
   npm install
   ```
5. Committer `package-lock.json`.
6. Exécuter :
   ```bash
   npm run verify
   ```
7. Vérifier CI verte sur `main`.
8. Seulement ensuite créer les branches du backlog.

## Types OpenAPI

Les types générés **ne sont pas commités**.

Ils sont recréés par `npm run verify` depuis `contracts/openapi.yaml`.

Cela supprime la possibilité de dérive entre un fichier généré commité et le contrat source.

## Critère de sortie Bootstrap 0

- package-lock commité;
- `npm ci` fonctionne;
- `npm run verify` retourne 0;
- CI verte une fois.
