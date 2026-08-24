# Écran Analyse — spécification complète

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Sous-vues

1. Synthèse
2. Récurrences
3. Efficacité
4. Révisions dues

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
