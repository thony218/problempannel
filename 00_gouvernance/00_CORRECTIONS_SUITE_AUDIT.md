# Corrections apportées à la suite de l'audit

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Maître d'orchestre**  
> Statut : **FROZEN**

## Verdict

L'audit est retenu. La V1 gouvernait bien l'équipe, mais reportait trop de décisions dans le futur.

## Blocages corrigés

| Audit | Correction |
|---|---|
| B-01 livrables fondateurs absents | dictionnaire, matrices, référentiels, scénarios inclus |
| B-02 OpenAPI/SQL/seed absents | vrais artefacts inclus |
| B-03 stack/arborescence absentes | stack et dépôt figés |
| B-04 arbitre humain obligatoire | règle R0/R1/R2 |
| B-05 étapes non vérifiables | backlog atomique + `npm run verify` |

## Contradictions corrigées

- endpoints admin ajoutés;
- routes GET de collaboration ajoutées;
- `reopenReason` vit dans l'historique;
- `effectivenessReviewDate` a une règle;
- matrice 4×4 complète;
- toute transition non autorisée explicitement est refusée.

## Angles morts corrigés

- ressources Cloudflare nommées;
- comportement réseau dégradé défini;
- volumétrie/performance;
- navigateurs;
- confidentialité comme gate production;
- documentation versionnée.

## Limite volontaire

Le dossier ne doit pas prendre seul une décision à fort risque juridique ou sécurité. Les R2 restent un arrêt ciblé, sans bloquer le reste du backlog.
