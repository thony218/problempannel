import React from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../features/auth/AuthContext";
import { PATHS } from "../routes/paths";
import { ThemeSwitcher } from "./ThemeSwitcher";

/**
 * Coquille et navigation principale. Les destinations sont des liens réels
 * (`NavLink`), pas des boutons pilotant un état local : un employé doit
 * pouvoir ouvrir le Registre dans un onglet, revenir en arrière, ou partager
 * l'URL d'un écran (01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md).
 *
 * La navigation est un rail vertical au bureau et une barre basse en mobile.
 * Le DOM est le même dans les deux cas — seule la grille CSS change — comme
 * l'impose 01_produit/ux/06_DESIGN_TOKENS_COMPOSANTS.md : « le DOM logique ne
 * doit pas être complètement différent entre mobile et desktop ».
 *
 * Le contenu de la route active est rendu par `<Outlet />`.
 */

/** En-tête réduit des états de session : ni navigation, ni contenu métier. */
function BareShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container is-bare">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="brand-mark" aria-hidden="true">R</span> Registre des erreurs
          </h1>
        </div>
      </header>
      <main className="main-content">{children}</main>
    </div>
  );
}

export function AppShell() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <BareShell>
        <div className="state-container" data-testid="loading-state">
          <div className="state-title">Chargement en cours...</div>
          <p className="state-message">Initialisation de la session et récupération des données.</p>
        </div>
      </BareShell>
    );
  }

  if (error) {
    return (
      <BareShell>
        <div className="state-container" data-testid="error-state">
          {error.status === 401 ? (
            <>
              <div className="state-title">Authentification requise</div>
              <p className="state-message">{error.message}</p>
            </>
          ) : error.status === 403 ? (
            <>
              <div className="state-title">Accès non autorisé</div>
              <p className="state-message">{error.message}</p>
            </>
          ) : (
            <>
              <div className="state-title">Erreur de communication</div>
              <p className="state-message">{error.message}</p>
              <button type="button" className="btn btn-primary" onClick={() => refresh()}>
                Réessayer
              </button>
            </>
          )}
        </div>
      </BareShell>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-btn ${isActive ? "active" : ""}`;

  const roleLabel =
    user?.role === "admin" ? "Admin" : user?.role === "manager" ? "Gestionnaire" : "Employé";

  const initials = (user?.displayName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="app-container">
      <a className="skip-link" href="#contenu-principal">Aller au contenu</a>

      <nav className="app-nav" aria-label="Navigation principale">
        <div className="nav-brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <b>Registre<span>des erreurs</span></b>
        </div>

        <div className="nav-content">
          <NavLink to={PATHS.home} className={navClass} data-testid="tab-home">
            <span className="nav-ico" aria-hidden="true">🏠</span>
            <span className="nav-txt">Accueil</span>
          </NavLink>
          <NavLink to={PATHS.registry} className={navClass} data-testid="tab-list">
            <span className="nav-ico" aria-hidden="true">📑</span>
            <span className="nav-txt">Registre</span>
          </NavLink>
          <NavLink to={PATHS.newIssue} className={navClass} data-testid="tab-new">
            <span className="nav-ico" aria-hidden="true">➕</span>
            <span className="nav-txt">Nouveau dossier</span>
          </NavLink>
          <NavLink to={PATHS.analytics} className={navClass} data-testid="tab-analytics">
            <span className="nav-ico" aria-hidden="true">📊</span>
            <span className="nav-txt">Analyse</span>
          </NavLink>
        </div>

        {user && (
          <div className="nav-user">
            <span className="avatar" aria-hidden="true">{initials}</span>
            <span>
              <b>{user.displayName}</b>
              <span>{roleLabel}</span>
            </span>
          </div>
        )}
      </nav>

      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span className="brand-mark" aria-hidden="true">R</span> Registre des erreurs
          </h1>
          <div className="user-badge-container">
            <ThemeSwitcher />
            {user && (
              <>
                <span className="user-name">{user.displayName}</span>
                <span className={`role-badge ${user.role}`}>{roleLabel}</span>
              </>
            )}
            {user?.role === "admin" && (
              <NavLink
                to={PATHS.admin}
                className="btn btn-secondary"
                data-testid="user-menu-admin"
                style={{ minHeight: "34px", padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
              >
                ⚙️ Administration
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="main-content" id="contenu-principal">
        <Outlet />
      </main>
    </div>
  );
}
