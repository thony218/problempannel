# Contrat fonctionnel final V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **Responsable produit**  
> Statut : **FROZEN**

## 1. Déclaration

Objectif : moins d'une minute.

Obligatoire :
1. occurredOn;
2. locationId;
3. categoryId;
4. description;
5. priority;
6. au moins un impact.

Facultatif au moment de déclarer :
- departmentId;
- subcategoryId;
- pièces jointes.

Status initial : `new`.

## 2. Triage

Manager/admin :
- confirme location/category;
- **choisit une sous-catégorie**;
- assigne owner;
- fixe dueDate si suivi;
- ajuste priorité;
- passe vers `inProgress` ou `waiting`.

Un dossier ne peut quitter `new` sans sous-catégorie.

## 3. Travail du responsable

Une fois owner assigné, le responsable peut :
- commenter;
- joindre fichiers;
- mettre à jour ses actions correctives;
- faire `inProgress ↔ waiting`.

Il ne peut pas :
- se réassigner;
- changer priorité;
- résoudre;
- rouvrir.

## 4. Waiting

### Interne
```json
{ "type": "user", "userId": 123 }
```

### Externe
```json
{ "type": "supplier", "label": "Nom du fournisseur" }
```

Customer/supplier/other exigent un label non vide.

## 5. Résolution

Manager/admin seulement.

Exige :
- causeStatus;
- causeSummary;
- permanentCorrectionType;
- permanentCorrectionSummary;
- finalResult;
- preventionLearning;
- effectivenessStatus;
- aucune action bloquante non terminée.

Si efficacité `pending`, date de revue = +30 jours si absente.

## 6. Révision efficacité

Les dossiers pending deviennent visibles dans :
- Analyse → Révisions dues;
- filtre `effectivenessReviewDueBefore`.

Aucun cron n'est requis pour rendre l'information accessible.

## 7. Récurrence

Deux signaux distincts :

### Récurrence locale
Même `locationId` + même `subcategoryId`, ≥3 cas en 90 jours.

### Récurrence organisation
Même `subcategoryId`, ≥3 cas en 90 jours, toutes localisations confondues.

Une catégorie sans sous-catégorie ne déclenche jamais de récurrence automatique.

## 8. No dossier

Format :

```text
INC-000042
```

- le nombre est l'ID global;
- il n'est pas remis à zéro annuellement;
- il n'encode aucune date;
- l'interface affiche toujours le libellé `No dossier`.

## 9. Caviardage

Admin + procédure R2.

Peut cibler :
- textes libres d'un dossier;
- commentaires;
- pièces jointes.

Les valeurs textuelles supprimées ne sont jamais recopiées dans l'historique. L'historique conserve uniquement :
- champ ciblé;
- acteur;
- raison;
- date.

## 10. Pièces jointes

Acceptées :
- JPEG
- PNG
- WebP
- HEIC
- HEIF
- PDF

10 MiB max et 10 fichiers actifs.

HEIC/HEIF peuvent avoir un aperçu générique.

## 11. Hors scope V1

IA, notifications automatiques, background sync, dossiers RH sensibles, hard-delete normal, multi-langue.
