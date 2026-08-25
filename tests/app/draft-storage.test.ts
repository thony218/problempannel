import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllDrafts,
  clearEditingDraft,
  listPendingUploads,
  loadEditingDraft,
  loadPendingUpload,
  promoteToPendingUpload,
  removePendingFile,
  saveEditingDraft,
  updatePendingFile,
  type DraftFields,
  type DraftFile,
} from "../../src/features/issues/draftStorage";

/**
 * V4-DRAFT-01 — machine d'état des brouillons
 * (`03_execution/07_BROUILLONS_INDEXEDDB.md`, scénarios S23-S25 et S45-S47).
 *
 * L'enjeu central n'est pas la persistance mais la **séparation des deux
 * états** : un `pendingUpload` désigne un dossier déjà créé côté serveur. S'il
 * réapparaissait dans l'écran Nouveau, l'employé recréerait un doublon en
 * croyant reprendre sa saisie.
 */

const fields: DraftFields = {
  occurredOn: "2026-08-24",
  locationId: 1,
  departmentId: 2,
  categoryId: 3,
  subcategoryId: 4,
  description: "Brouillon d'incident en cours de rédaction.",
  priority: "important",
  selectedImpacts: { 1: { selected: true, details: "" } },
};

function draftFile(id: string, name = "photo.jpg"): DraftFile {
  return {
    id,
    name,
    type: "image/jpeg",
    size: 1024,
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" }),
    uploadState: "pending",
  };
}

beforeEach(async () => {
  await clearAllDrafts();
});

describe("État editing (S23, S24)", () => {
  it("saves and restores the fields being typed", async () => {
    await saveEditingDraft(fields, [draftFile("f1")]);

    const restored = await loadEditingDraft();
    expect(restored).not.toBeNull();
    expect(restored!.state).toBe("editing");
    expect(restored!.issuePublicId).toBeNull();
    expect(restored!.fields.description).toBe("Brouillon d'incident en cours de rédaction.");
    expect(restored!.fields.priority).toBe("important");
    expect(restored!.files).toHaveLength(1);
    expect(restored!.files[0].name).toBe("photo.jpg");
  });

  it("clears the draft when the user abandons it", async () => {
    await saveEditingDraft(fields, []);
    await clearEditingDraft();
    expect(await loadEditingDraft()).toBeNull();
  });

  it("keeps files as blobs rather than base64", async () => {
    await saveEditingDraft(fields, [draftFile("f1")]);
    const restored = await loadEditingDraft();
    // Une base64 gonflerait chaque photo d'un tiers, pour un quota mobile déjà
    // court (V3-MOB-01 : « brouillon IndexedDB champs+Blob »).
    expect(restored!.files[0].blob).toBeInstanceOf(Blob);
  });
});

describe("Transition vers pendingUpload (S45, S46)", () => {
  it("moves the draft to pendingUpload and drops the business fields", async () => {
    await saveEditingDraft(fields, [draftFile("f1"), draftFile("f2", "facture.pdf")]);

    const pending = await promoteToPendingUpload("INC-000042", [
      draftFile("f1"),
      draftFile("f2", "facture.pdf"),
    ]);

    expect(pending).not.toBeNull();
    expect(pending!.state).toBe("pendingUpload");
    expect(pending!.issuePublicId).toBe("INC-000042");
    // Les champs vivent désormais côté serveur : les garder en local ferait
    // diverger deux copies de la même déclaration.
    expect(pending!.fields).toBeNull();
    expect(pending!.files).toHaveLength(2);
  });

  /**
   * S46 : « Nouveau ignore les pendingUpload ». C'est la garde anti-doublon —
   * sans elle, un brouillon rattaché à un dossier existant réapparaîtrait dans
   * le formulaire de déclaration.
   */
  it("never offers a pendingUpload back to the New Issue screen", async () => {
    await saveEditingDraft(fields, [draftFile("f1")]);
    await promoteToPendingUpload("INC-000042", [draftFile("f1")]);

    expect(await loadEditingDraft()).toBeNull();
    expect(await loadPendingUpload("INC-000042")).not.toBeNull();
  });

  /**
   * S24 : sans fichier à envoyer, une création réussie ne laisse rien derrière
   * elle — pas de `pendingUpload` vide qui afficherait un rappel sans objet.
   */
  it("leaves nothing behind when there is no file to upload", async () => {
    await saveEditingDraft(fields, []);
    const pending = await promoteToPendingUpload("INC-000043", []);

    expect(pending).toBeNull();
    expect(await loadEditingDraft()).toBeNull();
    expect(await listPendingUploads()).toHaveLength(0);
  });
});

describe("Reprise depuis le Détail (S47)", () => {
  it("returns only the files still pending for that file number", async () => {
    await promoteToPendingUpload("INC-000042", [draftFile("f1"), draftFile("f2", "facture.pdf")]);
    await promoteToPendingUpload("INC-000099", [draftFile("f3", "autre.jpg")]);

    const forFortyTwo = await loadPendingUpload("INC-000042");
    expect(forFortyTwo!.files.map((f) => f.name).sort()).toEqual(["facture.pdf", "photo.jpg"]);

    const forNinetyNine = await loadPendingUpload("INC-000099");
    expect(forNinetyNine!.files).toHaveLength(1);
    expect(forNinetyNine!.files[0].name).toBe("autre.jpg");
  });

  it("records a failure so the reason for the retry is visible", async () => {
    await promoteToPendingUpload("INC-000042", [draftFile("f1"), draftFile("f2")]);

    const after = await updatePendingFile("INC-000042", "f1", {
      uploadState: "failed",
      lastError: "Erreur réseau.",
    });

    expect(after!.files.find((f) => f.id === "f1")!.uploadState).toBe("failed");
    expect(after!.files.find((f) => f.id === "f1")!.lastError).toBe("Erreur réseau.");
  });

  it("drops each file as it succeeds, then removes the record entirely", async () => {
    await promoteToPendingUpload("INC-000042", [draftFile("f1"), draftFile("f2")]);

    const afterFirst = await updatePendingFile("INC-000042", "f1", { uploadState: "uploaded" });
    expect(afterFirst!.files).toHaveLength(1);

    // Le dernier fichier envoyé fait disparaître le brouillon : plus rien à
    // signaler, donc plus de rappel « Fichiers à compléter ».
    const afterSecond = await updatePendingFile("INC-000042", "f2", { uploadState: "uploaded" });
    expect(afterSecond).toBeNull();
    expect(await loadPendingUpload("INC-000042")).toBeNull();
  });

  it("lets the user give up on a file explicitly", async () => {
    await promoteToPendingUpload("INC-000042", [draftFile("f1"), draftFile("f2")]);

    const afterRemoval = await removePendingFile("INC-000042", "f1");
    expect(afterRemoval!.files.map((f) => f.id)).toEqual(["f2"]);

    expect(await removePendingFile("INC-000042", "f2")).toBeNull();
    expect(await loadPendingUpload("INC-000042")).toBeNull();
  });
});
