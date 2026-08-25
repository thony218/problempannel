import React from "react";
import { THEMES, applyTheme, readStoredTheme, type ThemeId } from "../features/theme/themes";

/**
 * Sélecteur de thème.
 *
 * Quatre pastilles plutôt qu'une liste déroulante : le choix est visuel, et
 * chaque pastille montre déjà le fond, l'encre et l'accent du thème qu'elle
 * applique. Le libellé reste disponible au lecteur d'écran et en infobulle.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = React.useState<ThemeId>(readStoredTheme);

  // Le premier rendu serveur ne pose pas l'attribut : on l'applique au montage
  // pour que le thème retenu survive à un rechargement.
  React.useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="theme-switcher" role="group" aria-label="Thème de l'interface">
      <span className="theme-label" aria-hidden="true">Thème</span>
      {THEMES.map((definition) => (
        <button
          key={definition.id}
          type="button"
          className="theme-dot"
          aria-pressed={theme === definition.id}
          title={`${definition.label} — ${definition.hint}`}
          data-testid={`theme-${definition.id}`}
          onClick={() => setTheme(definition.id)}
        >
          <i
            aria-hidden="true"
            style={{
              background: `linear-gradient(135deg, ${definition.swatch[0]} 0 50%, ${definition.swatch[2]} 50% 100%)`,
            }}
          />
          <span className="sr-only">{definition.label}</span>
        </button>
      ))}
    </div>
  );
}
