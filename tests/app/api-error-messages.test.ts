import { describe, expect, it } from "vitest";
import {
  ANCHORED_FIELD_ERRORS,
  bannerErrors,
  describeApiError,
  extractFieldErrors,
} from "../../src/features/issues/EditIssueModal";
import modalSource from "../../src/features/issues/EditIssueModal.tsx?raw";

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

/**
 * Deuxième moitié de la même exigence : `ux/05_ETATS_ET_MESSAGES.md` demande
 * que le message apparaisse **sous le champ concerné**, pas seulement quelque
 * part dans la modale. Le correctif QA-04 n'avait traité que le contenu; ces
 * tests verrouillent l'emplacement et, surtout, la garantie qu'aucun message
 * ne disparaît quand le champ visé n'a pas de contrôle affiché.
 */
describe("Placement des messages sous le champ concerné", () => {
  const fieldsBody = (fields: Record<string, string>) => ({
    error: { code: "VALIDATION_ERROR", message: "Validation échouée.", fields },
  });

  it("extracts the field messages as a map, not a concatenated string", () => {
    const errors = extractFieldErrors(
      fieldsBody({
        subcategoryId: "Sous-catégorie requise pour sortir du statut « Nouveau ».",
        ownerUserId: "Utilisateur introuvable ou inactif.",
      })
    );
    expect(errors.subcategoryId).toContain("Nouveau");
    expect(errors.ownerUserId).toContain("introuvable");
  });

  it("drops empty messages rather than rendering an empty red line", () => {
    expect(extractFieldErrors(fieldsBody({ subcategoryId: "", ownerUserId: "x" }))).toEqual({
      ownerUserId: "x",
    });
  });

  it("returns an empty map when the body carries no field detail", () => {
    expect(extractFieldErrors({ error: { message: "Interdit." } })).toEqual({});
    expect(extractFieldErrors(null)).toEqual({});
  });

  it("keeps every anchored field out of the banner", () => {
    // Ces champs ont un contrôle dans la modale : leur message s'affiche
    // dessous, le répéter en haut serait du bruit.
    const anchored = extractFieldErrors(
      fieldsBody({ subcategoryId: "a", status: "b", causeSummary: "c", waitingOn: "d" })
    );
    expect(bannerErrors(anchored)).toEqual([]);
  });

  it("promotes to the banner any field the modal does not render", () => {
    // `locationId` et `impacts` n'ont pas de contrôle dans cette modale pour un
    // gestionnaire. Sans ce repli, le refus serait affiché nulle part : c'est
    // exactement le défaut que la recette a mis au jour, sous une autre forme.
    const orphans = extractFieldErrors(
      fieldsBody({
        locationId: "Succursale introuvable ou inactive.",
        impacts: "Au moins un impact est requis.",
        subcategoryId: "ancré, donc absent du bandeau",
      })
    );
    const banner = bannerErrors(orphans);
    expect(banner).toHaveLength(2);
    expect(banner.join(" ")).toContain("Succursale");
    expect(banner.join(" ")).toContain("impact");
    expect(banner.join(" ")).not.toContain("ancré");
  });

  it("names only fields the modal actually anchors", () => {
    // Ajouter une clé ici sans écrire le `fieldError(...)` correspondant
    // ferait disparaître le message : la liste et le rendu doivent bouger
    // ensemble.
    for (const name of ANCHORED_FIELD_ERRORS) {
      expect(modalSource).toContain(`fieldError("${name}")`);
    }
  });
});
