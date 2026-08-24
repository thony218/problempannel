# États et messages UX

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## États obligatoires pour Nouveau, Registre et Détail

| État | Comportement |
|---|---|
| Loading | squelette de mise en page, pas spinner plein écran |
| Empty | message spécifique à l'écran |
| Validation | message sous champ |
| Réseau | contenu/saisie conservé, bouton Réessayer |
| 401 | `Votre session n'est plus active. Reconnectez-vous.` |
| 403 | `Vous n'avez pas l'autorisation d'effectuer cette action.` |
| 404 | `Ce dossier n'existe pas ou n'est plus accessible.` |
| 409 | dialogue conflit, aucun écrasement |
| 422 | messages champs fournis par API |
| 429 | `Trop d'actions en peu de temps. Réessayez dans quelques instants.` |
| Succès | confirmation courte, non bloquante |

## Messages précis

### Fichier trop gros
`Ce fichier dépasse 10 Mo. Choisissez un fichier plus petit.`

### Type non permis
`Format non pris en charge. Utilisez une photo JPEG, PNG, WebP, HEIC/HEIF ou un PDF.`

### Sous-catégorie requise au triage
`Choisissez une sous-catégorie avant de prendre ce dossier en charge.`

### Waiting incomplet
`Indiquez qui ou quoi nous attendons.`

### Révision efficacité
`Cette correction doit être réévaluée.`

### Brouillon restauré
`Votre brouillon a été restauré.`

## Toasts

Durée indicative 4–6 s.
Ne jamais utiliser un toast comme seule façon d'expliquer une erreur de validation.
