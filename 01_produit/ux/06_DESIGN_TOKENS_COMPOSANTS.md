# Design tokens et composants

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Typographie

Police système :
`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Tailles :
- titre page : 24/30, 700
- titre section : 18/24, 650
- corps : 16/24
- secondaire : 14/20
- micro : 12/16

## Espacement

Échelle :
4, 8, 12, 16, 24, 32, 48 px.

## Touch target

Minimum 44×44 px.

## Rayon

- contrôles : 8 px
- cartes : 12 px

## Couleurs sémantiques

- fond : `#F8FAFC`
- surface : `#FFFFFF`
- texte : `#0F172A`
- texte secondaire : `#475569`
- bordure : `#CBD5E1`
- action principale : `#1D4ED8`
- succès : `#047857`
- attention : `#B45309`
- urgent/erreur : `#B91C1C`

La couleur n'est jamais le seul indicateur : toujours texte/icône.

## Composants obligatoires

- AppShell
- BottomNavigation
- PageHeader
- IssueCard
- StatusBadge
- PriorityBadge
- FilterSheet
- FilterChip
- FormField
- SelectField
- ImpactSelector
- AttachmentPicker
- SectionCard
- EditableSection
- CorrectiveActionCard
- Timeline
- EmptyState
- ErrorState
- ConflictDialog
- ConfirmDialog
- Toast

## Responsive

Mobile : cartes pleine largeur.
Desktop : contenu principal max ~1200 px, sidebar filtres possible.
Le DOM logique ne doit pas être complètement différent entre mobile et desktop.
