import React from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "../features/auth/AuthContext";
import { PATHS } from "../routes/paths";

/**
 * Coquille et navigation principale. Les destinations sont des liens réels
 * (`NavLink`), pas des boutons pilotant un état local : un employé doit
 * pouvoir ouvrir le Registre dans un onglet, revenir en arrière, ou partager
 * l'URL d'un écran (01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md).
 *
 * Le contenu de la route active est rendu par `<Outlet />`.
 */
export function AppShell() {
  const { user, loading, error, refresh } = useAuth();

  if (loading) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">Registre des erreurs</h1>
          </div>
        </header>
        <main className="main-content">
          <div className="state-container" data-testid="loading-state">
            <div className="state-title">Chargement en cours...</div>
            <p className="state-message">Initialisation de la session et récupération des données.</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">Registre des erreurs</h1>
          </div>
        </header>
        <main className="main-content">
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
        </main>
      </div>
    );
  }

  const navClass = ({ isActive }: { isActive: boolean }) => `nav-btn ${isActive ? "active" : ""}`;

  const roleLabel =
    user?.role === "admin" ? "Admin" : user?.role === "manager" ? "Gestionnaire" : "Employé";

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <span>📋</span> Registre des erreurs
          </h1>
          {user && (
            <div className="user-badge-container">
              <span className="user-name">{user.displayName}</span>
              <span className={`role-badge ${user.role}`}>{roleLabel}</span>
            </div>
          )}
        </div>
      </header>

      <nav className="app-nav" aria-label="Navigation principale">
        <div className="nav-content">
          <NavLink to={PATHS.newIssue} className={navClass} data-testid="tab-new">
            ➕ Nouveau dossier
          </NavLink>
          <NavLink to={PATHS.registry} className={navClass} data-testid="tab-list">
            📑 Registre
          </NavLink>
          <NavLink to={PATHS.analytics} className={navClass} data-testid="tab-analytics">
            📊 Analyse
          </NavLink>
          {user?.role === "admin" && (
            <NavLink to={PATHS.admin} className={navClass} data-testid="tab-admin">
              ⚙️ Administration
            </NavLink>
          )}
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
