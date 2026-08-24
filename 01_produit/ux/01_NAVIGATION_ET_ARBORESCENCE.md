# Navigation et arborescence

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## Arborescence

```text
Accueil
├── Mes dossiers → Registre filtré owner=me
├── Urgents → Registre filtré priority=urgent
├── En attente → Registre filtré status=waiting
├── Révisions dues → Analyse/Révisions
└── Carte dossier → Détail

Registre
├── Recherche
├── Filtres
├── Liste
└── Détail

Nouveau
└── Détail après création réussie

Analyse
├── Vue synthèse
├── Récurrences
├── Efficacité
└── Révisions dues

Menu utilisateur
└── Administration (admin)
    ├── Utilisateurs
    ├── Localisations
    ├── Départements
    ├── Catégories
    ├── Sous-catégories
    └── Impacts
```

## Retour

Le bouton retour d'un Détail retourne à la liste et conserve les filtres précédents.

## Deep links

Une URL dossier doit ouvrir directement le détail après authentification.

## État URL

Les filtres du Registre doivent vivre dans l'URL afin que refresh/retour navigateur ne les perde pas.
