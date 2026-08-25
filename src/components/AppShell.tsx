import React from "react";
import { useAuth } from "../features/auth/AuthContext";

export type NavTab = "new" | "list" | "analytics";

export interface AppShellProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

export function AppShell({ currentTab, onTabChange, children }: AppShellProps) {
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
          <button
            type="button"
            className={`nav-btn ${currentTab === "new" ? "active" : ""}`}
            onClick={() => onTabChange("new")}
            data-testid="tab-new"
          >
            ➕ Nouveau dossier
          </button>
          <button
            type="button"
            className={`nav-btn ${currentTab === "list" ? "active" : ""}`}
            onClick={() => onTabChange("list")}
            data-testid="tab-list"
          >
            📑 Registre
          </button>
          <button
            type="button"
            className={`nav-btn ${currentTab === "analytics" ? "active" : ""}`}
            onClick={() => onTabChange("analytics")}
            data-testid="tab-analytics"
          >
            📊 Analyse
          </button>
        </div>
      </nav>

      <main className="main-content">{children}</main>
    </div>
  );
}
