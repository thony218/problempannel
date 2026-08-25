# Scénarios d'acceptation V3

> Version : **4.0.0**  
> Dernière mise à jour : **2026-08-24**  
> Propriétaire : **QA + produit**  
> Statut : **FROZEN**

## Création / triage
S01 création valide avec location.
S02 création sans location → 422.
S03 sous-catégorie absente à création → accepté.
S04 sortie new sans sous-catégorie → refusée.
S05 triage complet → inProgress.

## Workflow
S06 owner inProgress→waiting avec supplier+label → accepté.
S07 owner waiting→inProgress → accepté.
S08 non-owner employee change status → 403.
S09 supplier sans label → 422.
S10 manager résout complet.
S11 résolution avec action bloquante ouverte → refus.
S12 pending → reviewDate +30 j.
S13 réouverture avec raison.
S14 publicId mal formé → 404.

## Concurrence
S15 PATCH stale ETag → 409.
S16 PATCH sans If-Match → 428.

## Attribution employé
S53 manager attribue un employé actif → accepté et version incrémentée.
S54 employee attribue un collègue → 403.
S55 employé inconnu ou inactif → 422.
S56 analytique employé+sous-catégorie → agrégation exacte et manager+ seulement.

## Fichiers
S17 JPEG valide.
S18 HEIC valide.
S19 HEIF valide.
S20 fichier >10 MiB → 413.
S21 MIME interdit → 415.
S22 11e pièce jointe → 422.

## Brouillon mobile
S23 fermeture/éviction simulée puis retour → brouillon IndexedDB restauré.
S24 création réussie → brouillon supprimé.
S25 upload partiellement échoué → dossier conservé + retry fichier.

## Administration
S26 sous-catégorie sans categoryId → 422 au contrat.
S27 création location avec champ parent impossible au contrat.
S28 catégorie désactivée absente de Meta, anciens dossiers lisibles.

## Analytique
S29 récurrence locale 3/90.
S30 récurrence organisation 3/90.
S31 5 catégories sans sous-cat ne sont pas récurrentes — mais ne peuvent sortir new.
S32 effectivenessRate exclut pending.
S33 averageResolutionHours = resolvedAt-createdAt.
S34 reviewDueBefore retourne pending dus.

## Confidentialité
S35 mise à jour description n'écrit pas le texte dans history payload.
S36 caviardage description remplace le texte et trace actor/reason.
S37 caviardage PJ retire l'objet R2 ciblé.

## UX
S38 Nouveau respecte l'ordre des 9 blocs.
S39 Registre conserve filtres au retour.
S40 Détail affiche conflit 409 sans écraser.
S41 navigation primaire contient exactement 4 destinations.
S42 mobile 320 px sans scroll horizontal de tâche.

S43 caviardage avec reason seulement et aucune cible → 422.
S44 caviardage avec tableau cible vide → 422.
S45 après POST réussi + upload échoué, brouillon devient pendingUpload avec publicId.
S46 Nouveau ignore les pendingUpload.
S47 Détail reprend les pendingUpload du même publicId.
S48 Playwright collecte uniquement tests/e2e.
S49 Vitest n'exécute aucun fichier tests/e2e.
S50 image JPEG >2048 px décodable est réduite avant upload.
