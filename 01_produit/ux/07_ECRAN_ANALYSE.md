# Écran Analyse — spécification complète

> Version : **5.0.0**
> Dernière mise à jour : **2026-08-25**
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Sous-vues

1. Synthèse
2. Récurrences
3. Erreurs par employé — gestionnaire/admin seulement
4. Efficacité
5. Révisions dues

## Synthèse

Cartes :
- ouverts
- urgents
- en retard
- en attente
- résolus
- efficacité pending

## Récurrences

Deux blocs distincts :

### Dans une succursale
Groupes scope=location.

### Dans l'organisation
Groupes scope=organization.

Ne jamais mélanger les deux dans un seul compteur sans libellé.

## Erreurs par employé

Tableau groupé par employé concerné et sous-catégorie :
- nom affiché de l'employé;
- statut actif/inactif;
- type précis d'erreur;
- nombre de dossiers;
- lien vers le dossier le plus récent.

Cette sous-vue et son endpoint sont réservés aux gestionnaires et
administrateurs. Aucun courriel n'est exposé.

## Révisions dues

Liste dossier :
- No dossier
- correction permanente
- date de revue
- responsable
- bouton `Évaluer`

Filtre par défaut :
`effectivenessReviewDueBefore = aujourd'hui`.

## Efficacité

Afficher :
- effective
- ineffective
- pending
- taux sur évalués seulement

Texte sous le taux :
`Les corrections en attente de validation ne sont pas incluses dans le taux.`
