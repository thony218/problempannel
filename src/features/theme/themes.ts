/**
 * Thèmes visuels de l'application.
 *
 * Un thème n'est pas une palette : c'est un jeu complet de variables CSS
 * (couleurs, familles typographiques, rayons, filets, densité, cibles
 * tactiles) défini dans `src/styles.css`. Ce module ne fait que choisir
 * lequel est actif et le poser sur `<html data-theme>`.
 *
 * Les polices sont chargées **à la demande** : n'imposer les huit familles des
 * quatre thèmes à chaque première visite coûterait plus cher que le budget de
 * latence de 01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md ne le tolère. Seul
 * le thème réellement affiché télécharge les siennes.
 */

export type ThemeId = "atelier" | "ardoise" | "nuit" | "hv";

export interface ThemeDefinition {
  readonly id: ThemeId;
  /** Nom affiché à l'utilisateur. */
  readonly label: string;
  /** Contexte de travail auquel le thème répond. */
  readonly hint: string;
  /** Trois couleurs de pastille : fond, encre, accent. */
  readonly swatch: readonly [string, string, string];
  /** Feuille Google Fonts des familles de ce thème. */
  readonly fontsHref: string;
}

const PLEX = "family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600";

export const THEMES: readonly ThemeDefinition[] = [
  {
    id: "atelier",
    label: "Atelier",
    hint: "Comptoir, entrepôt, poste fixe",
    swatch: ["#e8eae6", "#1b2a2e", "#c63a11"],
    fontsHref: `https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&${PLEX}&display=swap`,
  },
  {
    id: "ardoise",
    label: "Ardoise",
    hint: "Gestionnaire, direction, analyse",
    swatch: ["#f1f4f6", "#0f1a21", "#0e6e77"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  },
  {
    id: "nuit",
    label: "Poste de nuit",
    hint: "Soir et nuit, écran d'atelier",
    swatch: ["#0b1013", "#e4edf1", "#5fb3d9"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=Chivo:wght@600;700;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap",
  },
  {
    id: "hv",
    label: "Haute visibilité",
    hint: "Route, installation, terrain",
    swatch: ["#ffffff", "#000000", "#ffd100"],
    fontsHref:
      "https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
  },
];

export const DEFAULT_THEME: ThemeId = "atelier";

/** Clé de persistance. Le choix est un confort local, jamais une donnée serveur. */
export const THEME_STORAGE_KEY = "registre.theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((theme) => theme.id === value);
}

export function findTheme(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

/**
 * Lit le thème retenu. Tolère l'absence de `window` (rendu serveur des tests)
 * et un `localStorage` refusé par le navigateur (mode privé, politique
 * d'entreprise) : dans les deux cas on retombe sur le thème par défaut plutôt
 * que de faire échouer le rendu.
 */
export function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Injecte la feuille de polices d'un thème, une seule fois par thème. */
export function ensureThemeFonts(id: ThemeId): void {
  if (typeof document === "undefined") return;
  const elementId = `theme-fonts-${id}`;
  if (document.getElementById(elementId)) return;

  const link = document.createElement("link");
  link.id = elementId;
  link.rel = "stylesheet";
  link.href = findTheme(id).fontsHref;
  document.head.appendChild(link);
}

/** Applique le thème : attribut, polices, persistance. */
export function applyTheme(id: ThemeId): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", id);
  ensureThemeFonts(id);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* Le thème reste appliqué pour la session même si l'écriture est refusée. */
  }
}
