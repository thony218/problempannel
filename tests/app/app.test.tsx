import React from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../../src/components/AppShell";
import * as authModule from "../../src/features/auth/AuthContext";

describe("Frontend Bootstrap & Components (META-02 & ISSUE-05)", () => {
  it("renders loading state when session is loading", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: null,
      meta: null,
      loading: true,
      error: null,
      refresh: async () => {},
    });

    const element = AppShell({
      currentTab: "new",
      onTabChange: () => {},
      children: React.createElement("div", null, "Contenu"),
    });

    expect(element.props.className).toBe("app-container");
  });

  it("renders 401 unauthenticated state when user is not authenticated", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: null,
      meta: null,
      loading: false,
      error: { status: 401, message: "Authentification requise." },
      refresh: async () => {},
    });

    const element = AppShell({
      currentTab: "new",
      onTabChange: () => {},
      children: React.createElement("div", null, "Contenu"),
    });

    expect(element.props.className).toBe("app-container");
  });

  it("renders 403 forbidden state when user is inactive", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: null,
      meta: null,
      loading: false,
      error: { status: 403, message: "Accès refusé." },
      refresh: async () => {},
    });

    const element = AppShell({
      currentTab: "new",
      onTabChange: () => {},
      children: React.createElement("div", null, "Contenu"),
    });

    expect(element.props.className).toBe("app-container");
  });

  it("renders normal app shell with navigation and header when authenticated", () => {
    vi.spyOn(authModule, "useAuth").mockReturnValue({
      user: {
        id: 1,
        email: "user@example.test",
        displayName: "Jean Dupont",
        role: "manager",
        active: true,
        defaultLocationId: null,
        defaultDepartmentId: null,
      },
      meta: {
        locations: [{ id: 1, code: "MTL", label: "Montréal", active: true, sortOrder: 1 }],
        departments: [],
        categories: [{ id: 1, code: "sales", label: "Ventes", active: true, sortOrder: 1 }],
        subcategories: [],
        impactTypes: [{ id: 1, code: "time_lost", label: "Temps perdu", active: true, sortOrder: 1 }],
        config: {
          businessTimeZone: "America/Toronto",
          maxAttachmentBytes: 10485760,
          maxAttachmentsPerIssue: 10,
          recurringWindowDays: 90,
          recurringMinCount: 3,
        },
      },

      loading: false,
      error: null,
      refresh: async () => {},
    });


    const element = AppShell({
      currentTab: "new",
      onTabChange: () => {},
      children: React.createElement("div", { "data-testid": "child-content" }, "Formulaire"),
    });

    expect(element.props.className).toBe("app-container");
  });
});
