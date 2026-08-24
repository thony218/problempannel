# Caviardage et historique

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Sécurité + confidentialité**  
> Statut : **FROZEN**

## But

Permettre une future procédure de rectification/destruction sans casser l'audit du dossier.

## Principe

L'immuabilité de l'historique s'applique aux **événements**, pas à l'obligation de conserver éternellement une donnée personnelle en clair.

## Texte libre

Pour ces champs :
- description
- causeSummary
- immediateSolution
- permanentCorrectionSummary
- finalResult
- preventionLearning
- commentaire

l'historique ne doit jamais enregistrer leur ancienne/nouvelle valeur brute.

Exemple historique :

```json
{
  "eventType": "field_updated",
  "fieldName": "description"
}
```

Pas le contenu.

## Caviardage

Endpoint admin dédié.

Le caviardage :
- remplace le texte ciblé par une valeur neutre;
- marque redactedAt/by/reason;
- supprime physiquement de R2 les fichiers explicitement ciblés;
- conserve uniquement les métadonnées minimales nécessaires à la trace de l'opération.

## Autorité

R2 : une procédure de caviardage n'est exécutée que pour un motif approuvé.
