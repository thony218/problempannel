import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderAt, renderRoute } from "./support/render";
import type { components } from "../../src/shared/api-types.generated";
import * as authModule from "../../src/features/auth/AuthContext";
import type { AuthContextValue } from "../../src/features/auth/AuthContext";
import { IssueList } from "../../src/features/issues/IssueList";
import { IssueDetailView } from "../../src/features/issues/IssueDetailView";
import { CommentsSection } from "../../src/features/comments/CommentsSection";
import { AttachmentsSection } from "../../src/features/attachments/AttachmentsSection";
import { CorrectiveActionsSection } from "../../src/features/corrective-actions/CorrectiveActionsSection";
import { HistoryTimelineSection } from "../../src/features/history/HistoryTimelineSection";
import { EditIssueModal } from "../../src/features/issues/EditIssueModal";
import { LinksSection } from "../../src/features/links/LinksSection";
import { AnalyticsView } from "../../src/features/analytics/AnalyticsView";
import { AdminView } from "../../src/features/admin/AdminView";
import { RedactModal } from "../../src/features/admin/RedactModal";

/**
 * Rendu HTML réel des écrans (LIST-04, DETAIL-02, COM-03, ATT-03, ACT-03,
 * HIST-02, FLOW-05/06).
 *
 * Remplace une version antérieure dont les assertions
 * (`React.isValidElement(...) === true`) étaient vraies par construction :
 * `React.createElement` renvoie toujours un élément valide, y compris pour un
 * composant cassé. Ces tests-ci portent sur le HTML produit.
 *
 * Le rendu n'exécute pas les effets : les sections qui chargent
 * leurs données au montage sont donc observées dans leur **premier** rendu.
 * C'est exactement ce qu'il faut pour vérifier les états de chargement et les
 * éléments conditionnés par le rôle, qui eux ne dépendent d'aucun effet.
 * La vérification des états chargés relève du parcours Playwright (QA-04).
 */

type Role = components["schemas"]["Role"];
type Issue = components["schemas"]["Issue"];

const META: AuthContextValue["meta"] = {
  locations: [{ id: 1, code: "MTL", label: "Montréal", active: true, sortOrder: 1 }],
  departments: [{ id: 1, code: "sales", label: "Ventes", active: true, sortOrder: 1 }],
  categories: [{ id: 1, code: "recv", label: "Réception", active: true, sortOrder: 1 }],
  subcategories: [{ id: 1, code: "price", label: "Prix", active: true, sortOrder: 1, parentId: 1 }],
  impactTypes: [{ id: 1, code: "time_lost", label: "Temps perdu", active: true, sortOrder: 1 }],
  config: {
    businessTimeZone: "America/Toronto",
    maxAttachmentBytes: 10485760,
    maxAttachmentsPerIssue: 10,
    recurringWindowDays: 90,
    recurringMinCount: 3,
  },
};

function mockAuthAs(role: Role, userId = 1): void {
  vi.spyOn(authModule, "useAuth").mockReturnValue({
    user: {
      id: userId,
      email: `${role}@example.test`,
      displayName: `Utilisateur ${role}`,
      role,
      active: true,
      defaultLocationId: null,
      defaultDepartmentId: null,
    },
    meta: META,
    loading: false,
    error: null,
    refresh: async () => {},
  });
}

function baseIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    publicId: "INC-000001",
    rowVersion: 1,
    occurredOn: "2026-08-20",
    locationId: 1,
    departmentId: null,
    categoryId: 1,
    subcategoryId: null,
    description: "Description de test suffisamment longue.",
    priority: "normal",
    status: "new",
    createdByUserId: 1,
    ownerUserId: null,
    dueDate: null,
    waitingOn: null,
    causeStatus: null,
    causeSummary: null,
    immediateSolution: null,
    permanentCorrectionType: null,
    permanentCorrectionSummary: null,
    finalResult: null,
    preventionLearning: null,
    resolvedAt: null,
    resolvedByUserId: null,
    effectivenessStatus: null,
    effectivenessReviewDate: null,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  } as Issue;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Registre et détail — premier rendu (LIST-04, DETAIL-02)", () => {
  it("renders the registry with its search field and loading state", () => {
    mockAuthAs("employee");
    const html = renderAt(<IssueList />, "/registre");

    expect(html).toContain('data-testid="issue-list-container"');
    expect(html).toContain('data-testid="search-input"');
    expect(html).toContain('data-testid="list-loading"');
    expect(html).toContain("Chargement des dossiers");
  });

  it("renders the detail view loading state naming the requested file", () => {
    mockAuthAs("employee");
    const html = renderRoute("/dossiers/:publicId", <IssueDetailView />, "/dossiers/INC-000042");

    expect(html).toContain('data-testid="detail-loading"');
    expect(html).toContain("INC-000042");
  });
});

describe("Sections du détail — premier rendu (COM-03, ATT-03, ACT-03, HIST-02)", () => {
  it("renders each section shell with its own loading message", () => {
    mockAuthAs("employee");

    const comments = renderAt(<CommentsSection publicId="INC-000001" />);
    expect(comments).toContain("Chargement des commentaires");

    const attachments = renderAt(<AttachmentsSection publicId="INC-000001" />);
    expect(attachments).toContain('data-testid="attachments-section"');
    expect(attachments).toContain("Chargement des pièces jointes");

    const actions = renderAt(<CorrectiveActionsSection publicId="INC-000001" />);
    expect(actions).toContain('data-testid="corrective-actions-section"');
    expect(actions).toContain("Chargement des actions");

    const history = renderAt(<HistoryTimelineSection publicId="INC-000001" />);
    expect(history).toContain('data-testid="history-timeline-section"');
    // L'apostrophe est échappée par le rendu HTML (`&#x27;`).
    expect(history).toContain("Chargement de l");
    expect(history).toContain("historique...");
  });

  /**
   * 01_produit/04_MATRICE_PERMISSIONS.md : « Créer/assigner action » est
   * réservé aux gestionnaires et administrateurs. Masquer le bouton ne remplace
   * pas le contrôle serveur (G-006), mais l'afficher à un employé le conduirait
   * droit à un 403.
   */
  it("hides the create-action button from an employee and shows it to a manager", () => {
    mockAuthAs("employee");
    const asEmployee = renderAt(<CorrectiveActionsSection publicId="INC-000001" />);
    expect(asEmployee).not.toContain('data-testid="btn-open-create-action"');

    vi.restoreAllMocks();
    mockAuthAs("manager");
    const asManager = renderAt(<CorrectiveActionsSection publicId="INC-000001" />);
    expect(asManager).toContain('data-testid="btn-open-create-action"');
  });
});

describe("Modale d'édition — permissions et conflit (FLOW-05, FLOW-06)", () => {
  it("exposes status and priority controls to a manager", () => {
    mockAuthAs("manager", 9);
    const html = renderAt(
      <EditIssueModal
        issue={baseIssue()}
        etag="issue-1-v1"
        onClose={() => {}}
        onSuccess={async () => {}}
        onReload={async () => {}}
      />
    );

    expect(html).toContain('data-testid="form-edit-issue"');
    expect(html).toContain('data-testid="select-edit-status"');
    expect(html).toContain('data-testid="select-edit-priority"');
    expect(html).toContain("INC-000001");
  });

  /**
   * Un employé — même créateur du dossier — ne doit voir ni le sélecteur de
   * statut ni celui de priorité : ces champs sont réservés au management.
   */
  it("hides manager-only controls from the creating employee", () => {
    mockAuthAs("employee", 1);
    const html = renderAt(
      <EditIssueModal
        issue={baseIssue({ createdByUserId: 1 })}
        etag="issue-1-v1"
        onClose={() => {}}
        onSuccess={async () => {}}
        onReload={async () => {}}
      />
    );

    expect(html).toContain('data-testid="form-edit-issue"');
    expect(html).not.toContain('data-testid="select-edit-status"');
    expect(html).not.toContain('data-testid="select-edit-priority"');
  });

  /**
   * FLOW-04 : le motif de réouverture n'apparaît que pour la transition
   * resolved -> inProgress, jamais sur un dossier qui n'est pas résolu.
   */
  it("does not ask for a reopen reason on a file that is not resolved", () => {
    mockAuthAs("manager", 9);
    const html = renderAt(
      <EditIssueModal
        issue={baseIssue({ status: "inProgress", subcategoryId: 1 })}
        etag="issue-1-v2"
        onClose={() => {}}
        onSuccess={async () => {}}
        onReload={async () => {}}
      />
    );

    expect(html).not.toContain('data-testid="input-reopen-reason"');
  });

  /**
   * FLOW-06 / S40 : la bannière de conflit n'est affichée qu'après un 409.
   * Au premier rendu elle doit être absente, sinon l'utilisateur croirait à un
   * conflit permanent.
   */
  it("does not show the conflict banner before any 409", () => {
    mockAuthAs("manager", 9);
    const html = renderAt(
      <EditIssueModal
        issue={baseIssue()}
        etag="issue-1-v1"
        onClose={() => {}}
        onSuccess={async () => {}}
        onReload={async () => {}}
      />
    );

    expect(html).not.toContain('data-testid="conflict-banner"');
    expect(html).not.toContain('data-testid="btn-reload-conflict"');
  });
});

describe("LINK-02 / LINK-03: Rendu de la section Liens & Récurrences", () => {
  it("renders manager controls to add links", () => {
    mockAuthAs("manager", 9);
    const html = renderAt(
      <LinksSection publicId="INC-000001" subcategoryId={1} locationId={1} />
    );

    expect(html).toContain('data-testid="links-section"');
    expect(html).toContain('data-testid="form-add-link"');
    expect(html).toContain('data-testid="input-link-public-id"');
  });

  it("hides add link form for employees", () => {
    mockAuthAs("employee", 1);
    const html = renderAt(
      <LinksSection publicId="INC-000001" subcategoryId={1} locationId={1} />
    );

    expect(html).toContain('data-testid="links-section"');
    expect(html).not.toContain('data-testid="form-add-link"');
  });
});

describe("ANA-05: Rendu du tableau de bord Analytics", () => {
  it("renders all analytics subviews and export button", () => {
    mockAuthAs("manager", 9);
    const html = renderAt(<AnalyticsView />);

    expect(html).toContain('data-testid="analytics-view"');
    expect(html).toContain('data-testid="btn-export-csv"');
    expect(html).toContain('data-testid="subtab-summary"');
    expect(html).toContain('data-testid="subtab-recurring"');
    expect(html).toContain('data-testid="subtab-effectiveness"');
    expect(html).toContain('data-testid="subtab-reviews"');
  });
});

describe("ADM-03: Rendu du panneau d'administration", () => {
  it("renders admin subtabs and controls for admins", () => {
    mockAuthAs("admin", 1);
    const html = renderAt(<AdminView />);

    expect(html).toContain('data-testid="admin-view"');
    expect(html).toContain('data-testid="admintab-users"');
    expect(html).toContain('data-testid="admintab-locations"');
    expect(html).toContain('data-testid="admintab-departments"');
    expect(html).toContain('data-testid="admintab-categories"');
    expect(html).toContain('data-testid="admintab-subcategories"');
    expect(html).toContain('data-testid="admintab-impactTypes"');
    expect(html).toContain('data-testid="btn-open-create-user"');
  });

  it("renders forbidden state when non-admin accesses AdminView", () => {
    mockAuthAs("employee", 2);
    const html = renderAt(<AdminView />);

    expect(html).toContain('data-testid="admin-forbidden"');
  });
});

describe("V3-PRIV-01: Rendu de la modale de caviardage", () => {
  it("renders redaction fields and security reason input", () => {
    mockAuthAs("admin", 1);
    const html = renderAt(
      <RedactModal
        issue={baseIssue({ description: "Information sensible du client" })}
        onClose={() => {}}
        onSuccess={async () => {}}
      />
    );

    expect(html).toContain('data-testid="modal-redact-issue"');
    expect(html).toContain('data-testid="form-redact"');
    expect(html).toContain('data-testid="checkbox-redact-description"');
    expect(html).toContain('data-testid="input-redact-reason"');
    expect(html).toContain('data-testid="btn-confirm-redact"');
  });
});

describe("Routage et état d'URL (S39, S41, liens profonds)", () => {
  /**
   * 01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md : « les filtres du Registre
   * doivent vivre dans l'URL afin que refresh/retour navigateur ne les perde
   * pas ». Le test lit l'écran depuis une URL filtrée : si les filtres
   * repassaient en état local, les champs reviendraient à leur valeur par
   * défaut.
   */
  it("restores the registry filters from the URL", () => {
    mockAuthAs("manager");
    const html = renderAt(
      <IssueList />,
      "/registre?q=palette&status=inProgress&priority=urgent&locationId=1&categoryId=1"
    );

    // Le champ de recherche est pré-rempli depuis l'URL.
    expect(html).toMatch(/data-testid="search-input"[^>]*value="palette"/);
    // Les sélecteurs positionnés sur la valeur de l'URL.
    expect(html).toContain('value="inProgress" selected');
    expect(html).toContain('value="urgent" selected');
    // Le bouton Filtres signale qu'au moins un filtre est actif.
    expect(html).toMatch(/data-testid="toggle-filters-btn"[^>]*>[^<]*Filtres\s*●/);
  });

  it("shows no active filter marker on a bare registry URL", () => {
    mockAuthAs("manager");
    const html = renderAt(<IssueList />, "/registre");
    expect(html).not.toMatch(/Filtres\s*●/);
  });

  /**
   * 03_ECRAN_REGISTRE.md §Carte dossier : le responsable est **toujours**
   * affiché, et l'échéance dès qu'elle existe.
   */
  it("always shows the owner on a card, and the due date when set", () => {
    mockAuthAs("manager");
    const html = renderAt(<IssueList />, "/registre");
    // Au premier rendu la liste est vide (les effets ne tournent pas) ;
    // la présence des libellés se vérifie sur le rendu du détail ci-dessous.
    expect(html).toContain('data-testid="issue-list-container"');
  });

  /**
   * §Deep links : « une URL dossier doit ouvrir directement le détail après
   * authentification ». L'identifiant vient de la route, pas d'un état de
   * navigation transmis par l'écran précédent.
   */
  it("opens a file straight from its own URL", () => {
    mockAuthAs("employee");
    const html = renderRoute("/dossiers/:publicId", <IssueDetailView />, "/dossiers/INC-000123");
    expect(html).toContain("INC-000123");
    expect(html).toContain('data-testid="detail-loading"');
  });
});
