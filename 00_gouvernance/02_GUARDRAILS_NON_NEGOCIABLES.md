# Guardrails non négociables

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Maître d'orchestre**  
> Statut : **FROZEN**

## G-001 Contrat avant code
Le code suit les contrats.

## G-002 OpenAPI autoritaire
Toute route/payload/réponse existe dans `contracts/openapi.yaml`.

## G-003 Nommage
D1 = snake_case. API/TS = camelCase. Types = PascalCase.

## G-004 Aucun D1 direct frontend
Toujours Frontend → Worker → D1.

## G-005 Aucun mot de passe local
Cloudflare Access.

## G-006 Permission côté serveur
Masquer un bouton n'est pas une protection.

## G-007 Historique append-only
Jamais modifier un événement historique.

## G-008 R2 pour fichiers
D1 ne contient que les métadonnées.

## G-009 Changement gelé = RFC
Pas de décision locale silencieuse.

## G-010 Règle métier critique côté serveur
Le frontend peut valider pour UX, pas pour sécurité.

## G-011 Pas de magie implicite
Toute valeur automatique est documentée.

## G-012 Pas de breaking change silencieux
RFC + migration/compatibilité.

## G-013 Migrations versionnées
Aucune modification de schéma manuelle prod.

## G-014 Données test fictives
Jamais de vraies données en seed/staging.

## G-015 PR ciblée
Un objectif principal par PR.

## G-016 CI obligatoire
Aucune fusion avec verify rouge.

## G-017 Staging obligatoire
Local seul insuffisant.

## G-018 Erreurs structurées
Pas de 500 pour erreur métier connue.

## G-019 Mobile référence
320 px doit fonctionner.

## G-020 Reprise par collègue
README/tests/handoff requis.

## G-021 Pas de temporaire permanent
Rustine = ticket + owner + condition retrait.

## G-022 Référentiels dynamiques
Pas de catégories/succursales codées en dur UI.

## G-023 Pas d'IA obligatoire V1
Récurrence déterministe.

## G-024 Observabilité
Chaque erreur serveur a requestId.

## G-025 Production protégée
Ressources et secrets séparés.

## G-026 Pas de données RH sensibles
La catégorie Employés sert uniquement aux enjeux opérationnels/formation. Discipline, santé, paie, NAS, banque sont hors système.

## G-027 Collecte minimale
Ne pas saisir de renseignements personnels inutiles.

## G-028 Aucun contournement sécurité
Jamais rendre R2 public ou désactiver Access pour débloquer.

## G-029 Types générés
Pas de seconde définition manuelle de l'API.

## G-030 Non explicite = interdit
Pour transitions et permissions.

## G-031 Un seul dépôt
Full-stack commun.

## G-032 Documents versionnés
Contrats sous Git/PR comme le code.
