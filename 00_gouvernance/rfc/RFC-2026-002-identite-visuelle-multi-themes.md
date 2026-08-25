# RFC-2026-002 — Identité visuelle à quatre thèmes interchangeables

> Date : **2026-08-25**
> Classe : **R1 — modification d'un contrat gelé de présentation**
> Statut : **APPLIQUÉE**
> Autorité : demande explicite du propriétaire du projet le 2026-08-25

## Problème

`01_produit/ux/06_DESIGN_TOKENS_COMPOSANTS.md` (FROZEN, v4.0.0) fixe une
palette unique : fond `#F8FAFC`, action principale `#1D4ED8`, police système,
rayons 8/12 px. Le propriétaire du projet juge le résultat trop générique et
demande une identité propre, ainsi que la possibilité de passer d'un thème à
l'autre à volonté.

Le besoin n'est pas seulement esthétique. Le registre est consulté dans des
contextes physiques très différents : un comptoir de succursale, un écran
d'atelier peu éclairé le soir, une tablette en camion en plein soleil. Une
palette unique ne peut pas convenir aux trois.

## Décision

- Remplacer la palette unique par **quatre thèmes complets**, chacun défini par
  un jeu de variables CSS : couleurs, familles typographiques, rayons,
  épaisseur des filets, densité, hauteur des cibles tactiles.
  - `atelier` — comptoir, entrepôt, poste fixe. Thème par défaut.
  - `ardoise` — gestionnaire, direction, lecture et décision.
  - `nuit` — soir et nuit, écran d'atelier peu éclairé.
  - `hv` — route et installation : noir sur blanc, filets 2 px, cibles 56 px.
- Porter le thème actif sur `<html data-theme>`. Sans attribut, `atelier`
  s'applique : l'interface reste correcte si le script ne s'exécute pas.
- Persister le choix dans `localStorage` sous `registre.theme`. Le thème est un
  confort local, jamais une donnée serveur ni une préférence de compte.
- Charger les polices d'un thème **à la demande**, à sa première activation.
- Conserver les noms de classes existants (`card`, `btn`, `form-control`,
  `nav-btn`, …) et ajouter des alias `--color-*` vers les nouveaux jetons, afin
  que les écrans déjà écrits héritent du thème sans réécriture.
- Passer la navigation principale en rail vertical au bureau et en barre basse
  en mobile, avec un DOM identique dans les deux cas.

## Garde-fous

- La couleur n'est jamais le seul indicateur : chaque statut et chaque priorité
  restent portés par un mot, conformément au contrat gelé.
- Contrastes vérifiés sur chaque paire texte/fond des quatre thèmes : tous
  ≥ 4,5:1 (WCAG AA).
- Cibles tactiles : 44 px minimum, 56 px sur le thème `hv`. Le minimum du
  contrat gelé est respecté, jamais abaissé.
- Aucun débordement horizontal à 320, 375 et 430 px, sur les six écrans et les
  quatre thèmes.
- `prefers-reduced-motion` neutralise les transitions.
- Aucun contrat fonctionnel, aucune route, aucun champ API, aucune permission
  n'est touché : le changement est strictement de présentation.

## Portée du contrat gelé

Cette RFC modifie **uniquement** la section « Couleurs sémantiques »,
« Typographie » et « Rayon » de
`01_produit/ux/06_DESIGN_TOKENS_COMPOSANTS.md`. La liste des composants
obligatoires, la règle des 44 px, la règle « la couleur n'est jamais le seul
indicateur » et la contrainte de DOM commun mobile/desktop restent inchangées
et sont respectées.

Le document gelé n'est pas réécrit par cette RFC : il devra l'être, en version
5.0.0, une fois la RFC acceptée formellement.

## Compatibilité et migration

Aucune migration de données. Le changement est additif côté interface :
un utilisateur sans thème enregistré obtient `atelier`, qui reprend la
structure d'écran existante.

## Preuves obtenues le 2026-08-25

- `npx vitest run` : 35 fichiers, 261 tests, tous verts — identique à la
  mesure de référence prise avant l'intervention.
- `npx tsc -p tsconfig.app.json --noEmit` et `-p tsconfig.test.json` : verts.
- `npx vite build` : succès; feuille de style 19,85 kB (4,98 kB gzip) pour les
  quatre thèmes.
- Contrastes calculés sur les paires texte/fond des quatre thèmes : tous
  ≥ 4,5:1.
- Absence de débordement horizontal mesurée par `scrollWidth` sur
  `/accueil`, `/registre`, `/nouveau`, `/analyse`, `/administration` et un
  détail de dossier, à 320, 375 et 430 px, dans les quatre thèmes.

## Dette connue

`src/features/issues/IssueDetailView.tsx` et
`src/features/issues/EditIssueModal.tsx` contiennent encore 18 couleurs codées
en dur. Ces deux fichiers étaient en cours de modification par un autre travail
au moment de l'intervention et n'ont pas été touchés, conformément à
`AGENTS.md`. Leurs pastilles de statut ne suivent donc pas encore le thème
actif. À reprendre dès que ces fichiers sont libres.

## Preuves attendues avant acceptation formelle

- réécriture de `01_produit/ux/06_DESIGN_TOKENS_COMPOSANTS.md` en v5.0.0;
- `npm run verify` complet;
- Playwright sur les quatre thèmes;
- validation du thème par défaut par le propriétaire du projet.
