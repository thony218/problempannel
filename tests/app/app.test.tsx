import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderLayout } from "./support/render";
import { AppShell } from "../../src/components/AppShell";
import * as authModule from "../../src/features/auth/AuthContext";
import type { AuthContextValue } from "../../src/features/auth/AuthContext";

/**
 * Ces tests rendent réellement le composant en HTML (`renderToStaticMarkup`)
 * et vérifient le contenu produit.
 *
 * Ils remplacent une version antérieure qui n'assertait que
 * `React.isValidElement(...) === true` et `element.props.className` : deux
 * conditions vraies quel que soit le contenu rendu, y compris pour un shell
 * vide. Un test doit pouvoir échouer si le comportement décrit disparaît.
 *
 * `renderToStaticMarkup` n'exécute pas les effets : ce qui est vérifié ici est
 * le premier rendu, ce qui suffit pour les états pilotés par le contexte
 * d'authentification (META-02).
 */

function mockAuth(value: Partial<AuthContextValue>): void {
  vi.spyOn(authModule, "useAuth").mockReturnValue({
    user: null,
    meta: null,
    loading: false,
    error: null,
    refresh: async () => {},
    ...value,
  });
}

/**
 * `AppShell` est une route de mise en page : elle rend l'onglet actif d'après
 * l'URL et le contenu via `<Outlet />`. Le test fournit donc une URL, pas un
 * onglet.
 */
function renderShell(path = "/nouveau"): string {
  return renderLayout(<AppShell />, <div data-testid="child-content">Contenu enfant</div>, path);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppShell — états de session (META-02)", () => {
  it("shows the loading state and hides the navigation while the session loads", () => {
    mockAuth({ loading: true });
    const html = renderShell();

    expect(html).toContain('data-testid="loading-state"');
    expect(html).toContain("Chargement en cours");
    // Ni navigation ni contenu métier tant que le rôle est inconnu.
    expect(html).not.toContain('data-testid="tab-new"');
    expect(html).not.toContain("child-content");
  });

  it("shows the authentication-required state on 401 without leaking the app content", () => {
    mockAuth({ error: { status: 401, message: "Authentification requise." } });
    const html = renderShell();

    expect(html).toContain('data-testid="error-state"');
    expect(html).toContain("Authentification requise");
    expect(html).not.toContain("child-content");
    // Un 401 n'est pas réessayable côté client : c'est Access qui doit statuer.
    expect(html).not.toContain("Réessayer");
  });

  it("shows the forbidden state on 403 for an inactive account", () => {
    mockAuth({ error: { status: 403, message: "Votre compte est inactif." } });
    const html = renderShell();

    expect(html).toContain("Accès non autorisé");
    expect(html).toContain("Votre compte est inactif.");
    expect(html).not.toContain("child-content");
  });

  it("offers a retry on a network error (status 0)", () => {
    mockAuth({ error: { status: 0, message: "Impossible de contacter le serveur." } });
    const html = renderShell();

    expect(html).toContain("Erreur de communication");
    expect(html).toContain("Réessayer");
  });

  it("renders the header, the role badge, the navigation and the children when authenticated", () => {
    mockAuth({
      user: {
        id: 1,
        email: "user@example.test",
        displayName: "Jean Dupont",
        role: "manager",
        active: true,
        defaultLocationId: null,
        defaultDepartmentId: null,
      },
    });
    const html = renderShell("/registre");

    expect(html).toContain("Registre des erreurs");
    expect(html).toContain("Jean Dupont");
    // Le libellé de rôle est traduit, pas la valeur brute de l'API.
    expect(html).toContain("Gestionnaire");
    expect(html).not.toContain(">manager<");
    expect(html).toContain('data-testid="tab-new"');
    expect(html).toContain('data-testid="tab-list"');
    expect(html).toContain('data-testid="tab-home"');
    expect(html).toContain('data-testid="tab-analytics"');
    expect(html).not.toContain('data-testid="user-menu-admin"');
    expect(html).toContain("child-content");
  });

  it("keeps administration as a secondary destination visible only to admins", () => {
    mockAuth({
      user: {
        id: 3,
        email: "admin@example.test",
        displayName: "Admin locale",
        role: "admin",
        active: true,
        defaultLocationId: null,
        defaultDepartmentId: null,
      },
    });

    const html = renderShell("/accueil");
    expect(html).toContain('data-testid="user-menu-admin"');
    expect(html).toContain('href="/administration"');
  });

  it("marks the active tab so the current destination is visible", () => {
    mockAuth({
      user: {
        id: 2,
        email: "emp@example.test",
        displayName: "Alex Roy",
        role: "employee",
        active: true,
        defaultLocationId: null,
        defaultDepartmentId: null,
      },
    });

    const onNewTab = renderShell("/nouveau");
    const onListTab = renderShell("/registre");

    // NavLink pose la classe active et `aria-current` d'après l'URL courante,
    // et rend un vrai lien : la destination s'ouvre dans un nouvel onglet, se
    // copie, se partage — ce qu'un bouton ne permettait pas.
    const activeLink = (html: string) => html.match(/<a[^>]*class="nav-btn active"[^>]*>/)?.[0] ?? "";

    expect(activeLink(onNewTab)).toContain('data-testid="tab-new"');
    expect(activeLink(onNewTab)).toContain('href="/nouveau"');
    expect(activeLink(onNewTab)).toContain('aria-current="page"');

    expect(activeLink(onListTab)).toContain('data-testid="tab-list"');
    expect(activeLink(onListTab)).toContain('href="/registre"');
    expect(onNewTab).toContain("Employé");
  });
});
