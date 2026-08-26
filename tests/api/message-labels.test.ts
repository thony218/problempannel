import { describe, expect, it } from "vitest";
import { AppError } from "../../worker/domain/errors";
import { ISSUE_STATUS_LABELS, fieldLabel, statusLabel } from "../../worker/domain/labels";
import {
  ISSUE_STATUS_LABELS as SHARED_STATUS_LABELS,
  ISSUE_STATUS_ORDER,
} from "../../src/shared/issueLabels";
import { validateStatusTransition, type ApiIssueStatus } from "../../worker/domain/transitions";
import { validateIssueUpdatePermissions } from "../../worker/domain/permissions";
import type { IssueRow } from "../../worker/db/issues";

/**
 * La recette authentifiée du 2026-08-26 a affiché « Sous-catégorie requise
 * pour sortir du statut 'new'. » dans la modale d'édition, en production.
 *
 * Ce n'était pas visible avant : tant que l'écran jetait `error.fields` au
 * profit d'un « Validation échouée. » générique, aucun de ces messages
 * n'atteignait un humain. Le correctif QA-04 les a rendus visibles, et a
 * donc transformé une imprécision interne en défaut d'interface.
 *
 * `01_produit/ux/05_ETATS_ET_MESSAGES.md` veut des messages destinés à
 * l'utilisateur. Ces tests verrouillent les deux moitiés : les libellés
 * existent et sont complets, et aucun message ne laisse passer la valeur
 * brute de l'énumération.
 */
describe("worker/domain/labels — messages destinés aux personnes", () => {
  const statuses: ApiIssueStatus[] = ["new", "inProgress", "waiting", "resolved"];

  it("couvre les quatre statuts du contrat", () => {
    for (const status of statuses) {
      expect(ISSUE_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(Object.keys(ISSUE_STATUS_LABELS).sort()).toEqual([...statuses].sort());
  });

  it("est la source unique partagée avec les écrans", () => {
    // Les écrans importent ce même tableau (`src/shared/issueLabels.ts`) pour
    // construire leur sélecteur de statut. L'égalité de référence le prouve :
    // une copie côté Worker romprait ce test, pas seulement sa valeur.
    expect(ISSUE_STATUS_LABELS).toBe(SHARED_STATUS_LABELS);
    expect(ISSUE_STATUS_ORDER).toEqual(statuses);
  });

  it("encadre les libellés de guillemets français", () => {
    expect(statusLabel("new")).toBe("« Nouveau »");
    expect(fieldLabel("permanentCorrectionSummary")).toBe("« Résumé de la correction permanente »");
  });

  it("retombe sur la clé brute pour un champ non étiqueté, sans planter", () => {
    // Repli volontaire : un champ ajouté au contrat sans libellé produit un
    // message imparfait, jamais un message vide.
    expect(fieldLabel("version" as never)).toBe("« version »");
  });
});

describe("Aucune valeur brute d'énumération dans les messages d'erreur", () => {
  const rawStatusPattern = /'(new|inProgress|waiting|resolved)'/;

  /** Message porté par l'AppError levée, ou `null` si rien n'a été levé. */
  function messageOf(run: () => void): string | null {
    try {
      run();
      return null;
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      return (error as AppError).message;
    }
  }

  it("nomme les statuts en clair dans toutes les transitions refusées", () => {
    const refused: [ApiIssueStatus, ApiIssueStatus][] = [
      ["inProgress", "new"],
      ["waiting", "new"],
      ["resolved", "new"],
      ["resolved", "waiting"],
    ];

    for (const [fromStatus, toStatus] of refused) {
      const message = messageOf(() =>
        validateStatusTransition({ fromStatus, toStatus, actorRole: "admin", isOwner: false })
      );
      expect(message, `${fromStatus} -> ${toStatus}`).not.toBeNull();
      expect(message, `${fromStatus} -> ${toStatus}`).not.toMatch(rawStatusPattern);
      expect(message).toContain(ISSUE_STATUS_LABELS[toStatus]);
    }
  });

  it("nomme les statuts en clair quand un employé n'a pas le privilège requis", () => {
    const message = messageOf(() =>
      validateStatusTransition({
        fromStatus: "new",
        toStatus: "inProgress",
        actorRole: "employee",
        isOwner: false,
      })
    );
    expect(message).not.toMatch(rawStatusPattern);
    expect(message).toContain("Nouveau");
    expect(message).toContain("En cours");
  });

  it("nomme le champ et le statut en clair quand un employé touche un champ réservé", () => {
    const current = {
      status: "inProgress",
      created_by_user_id: 1,
      owner_user_id: 1,
    } as IssueRow;

    const reserved = messageOf(() =>
      validateIssueUpdatePermissions({
        current,
        input: { permanentCorrectionSummary: "x" },
        actorUserId: 1,
        actorRole: "employee",
      })
    );
    expect(reserved).toContain("Résumé de la correction permanente");
    expect(reserved).not.toContain("permanentCorrectionSummary");

    const tooLate = messageOf(() =>
      validateIssueUpdatePermissions({
        current,
        input: { description: "x" },
        actorUserId: 1,
        actorRole: "employee",
      })
    );
    expect(tooLate).not.toMatch(rawStatusPattern);
    expect(tooLate).toContain("Nouveau");
  });
});
