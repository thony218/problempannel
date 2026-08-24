# Processus de handoff

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Intégrateur**  
> Statut : **FROZEN**

## Handoff valide

Doit contenir :

1. Task IDs;
2. PR/commit;
3. versions contrats;
4. fichiers produits;
5. commandes exécutées;
6. résultat `npm run verify`;
7. staging testé oui/non;
8. limitations connues;
9. RFC;
10. prochain propriétaire.

Un simple « fini » n'est pas un handoff.

## Handoffs critiques

### Produit → Backend/D1/UX
Dictionnaire + matrices + scénarios.

### Backend → Frontend
OpenAPI + types générés + URL staging + exemples + erreurs.

### UX → Frontend
Écrans + états + responsive.

### Modules → QA
Critères + fixtures + limitations.

### Modules → Intégrateur
En continu dès Vague B.
