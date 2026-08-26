import { describe, expect, it } from "vitest";
import { describeApiError } from "../../src/features/issues/EditIssueModal";

/**
 * `01_produit/ux/05_ETATS_ET_MESSAGES.md` : pour un 422, l'interface doit
 * afficher les « messages champs fournis par API », et ne jamais expliquer une
 * erreur de validation autrement.
 *
 * Le contrat d'erreur (`02_contrats/05_ERREURS.md`) place le détail utile dans
 * `error.fields`; `error.message` reste générique (« Validation échouée. »).
 * Une interface qui n'affiche que `message` laisse donc l'utilisateur devant
 * un refus sans cause : c'était le cas de la modale de modification, où une
 * résolution refusée pour cause d'action corrective bloquante n'affichait
 * aucune mention de cette action.
 */
describe("Messages d'erreur de l'API dans l'interface", () => {
  it("prefers the per-field messages over the generic one", () => {
    const body = {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation échouée.",
        fields: {
          status: "Impossible de résoudre le dossier : 1 action(s) corrective(s) bloquante(s) non terminée(s).",
        },
        requestId: "req_1",
      },
    };

    const message = describeApiError(body, 422);
    expect(message).toContain("bloquante");
    expect(message).not.toBe("Validation échouée.");
  });

  it("joins several field messages so none is silently dropped", () => {
    const body = {
      error: {
        message: "Validation échouée.",
        fields: {
          subcategoryId: "Choisissez une sous-catégorie avant de prendre ce dossier en charge.",
          waitingOn: "Indiquez qui ou quoi nous attendons.",
        },
      },
    };

    const message = describeApiError(body, 422);
    expect(message).toContain("sous-catégorie");
    expect(message).toContain("attendons");
  });

  it("falls back to the generic message when the API sends no field detail", () => {
    const body = { error: { code: "FORBIDDEN", message: "Vous n'avez pas l'autorisation." } };
    expect(describeApiError(body, 403)).toBe("Vous n'avez pas l'autorisation.");
  });

  it("still says something useful when the body is unusable", () => {
    expect(describeApiError(null, 500)).toContain("500");
    expect(describeApiError({ error: { fields: {} } }, 422)).toContain("422");
  });
});
