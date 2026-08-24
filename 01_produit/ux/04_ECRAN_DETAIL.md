# Écran Détail — spécification complète

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable UX**  
> Statut : **FROZEN**

## En-tête

```text
< Registre
INC-000042
URGENTE · En cours

Erreur de réception...
Montréal · Achats et stock
```

## Sections dans cet ordre

### 1. Situation
- date incident;
- localisation;
- département;
- catégorie;
- sous-catégorie;
- description;
- impacts.

### 2. Prise en charge
- priorité;
- responsable;
- échéance;
- status;
- waitingOn si waiting.

### 3. Analyse
- causeStatus;
- causeSummary.

### 4. Solution immédiate

### 5. Correction permanente
- type;
- résumé.

### 6. Actions correctives
Cartes avec owner, dueDate, status, bloque clôture.

### 7. Résultat et prévention
- finalResult;
- preventionLearning;
- effectivenessStatus;
- effectivenessReviewDate.

### 8. Commentaires

### 9. Pièces jointes

### 10. Cas similaires

### 11. Historique

## Mode lecture / édition

Par défaut : lecture.

Une section éditable affiche `Modifier`.

En édition :
- boutons `Annuler` / `Enregistrer`;
- pas de sauvegarde globale de 40 champs.

## Triage manager/admin

Si status=new, afficher bloc prioritaire :

`Ce dossier doit être pris en charge.`

Champs exigés avant sortie new :
- sous-catégorie;
- owner recommandé;
- status cible.

## Owner

Si owner + status inProgress :
CTA secondaire `Mettre en attente`.

Si owner + status waiting :
CTA secondaire `Reprendre le travail`.

## Résolution

Bouton `Régler le dossier` visible manager/admin seulement.

Ouvre panneau contenant uniquement les champs encore manquants pour résolution.

Si action bloquante ouverte :
`Ce dossier ne peut pas être réglé : 1 action corrective obligatoire est encore ouverte.`

## Conflit 409

Modal :

**Le dossier a changé**

`Quelqu'un a enregistré une modification depuis votre dernière lecture. Vos changements n'ont pas été écrasés.`

Actions :
- `Recharger le dossier`
- `Copier mon texte` si texte libre non sauvegardé.

Jamais fusion automatique silencieuse.

## Fichiers à compléter

Si IndexedDB contient un `pendingUpload` pour ce No dossier :

Afficher une carte en haut de la section Pièces jointes :

`2 fichiers n'ont pas encore été envoyés.`

Actions :
- `Réessayer`
- `Retirer`
- état par fichier

Aucune nouvelle issue n'est créée.
