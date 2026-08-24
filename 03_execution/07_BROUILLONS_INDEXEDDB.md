# Brouillons IndexedDB — machine d'état V4

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Frontend + UX**  
> Statut : **FROZEN**

## Décision

Le formulaire `Nouveau` utilise IndexedDB avec **deux états distincts**.

## Modèle

```ts
type IssueDraft =
  | {
      state: "editing";
      draftId: string;
      issuePublicId: null;
      fields: DraftFields;
      files: LocalFile[];
      updatedAt: string;
    }
  | {
      state: "pendingUpload";
      draftId: string;
      issuePublicId: string;
      fields: null;
      files: LocalFileWithUploadState[];
      updatedAt: string;
    };
```

## État `editing`

Le dossier n'existe pas encore côté serveur.

L'écran Nouveau peut :
- restaurer;
- modifier;
- supprimer.

## Passage à `pendingUpload`

Dès que `POST /issues` réussit :

1. enregistrer immédiatement `issuePublicId`;
2. passer le brouillon à `pendingUpload`;
3. supprimer les champs métier locaux devenus inutiles;
4. conserver seulement les fichiers non envoyés et leur état;
5. lancer les uploads.

Cette transition doit arriver **avant** le premier upload.

## État `pendingUpload`

Le dossier existe déjà.

Il ne doit **jamais** être proposé par l'écran Nouveau.

Il est repris uniquement depuis :
- le Détail du dossier;
- éventuellement une carte `Fichiers à compléter` sur Accueil.

Actions :
- Réessayer;
- Retirer le fichier local;
- Ouvrir le dossier.

Quand tous les uploads sont réussis ou explicitement retirés :
- supprimer l'enregistrement IndexedDB.

## Prévention des doublons

L'écran Nouveau filtre strictement :

```text
state = editing
```

Un `pendingUpload` ne peut donc jamais recréer un dossier.

## Conservation

Après 24 h :
- `editing` → proposer Reprendre/Supprimer;
- `pendingUpload` → afficher rappel dans Détail/Accueil, jamais dans Nouveau.
