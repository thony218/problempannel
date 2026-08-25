import { describe, expect, it, beforeEach } from "vitest";
import { clearDraft, loadDraft, saveDraft, type IssueDraft } from "../../src/features/issues/draftStorage";

describe("ISSUE-06: Draft Storage Service (IndexedDB / LocalStorage fallback, S23-S24)", () => {
  const sampleDraft: IssueDraft = {
    occurredOn: "2026-08-24",
    locationId: 1,
    departmentId: 2,
    categoryId: 3,
    subcategoryId: 4,
    description: "Ceci est un brouillon d'incident en cours de rédaction.",
    priority: "important",
    selectedImpacts: { 1: { selected: true, details: "" } },
    attachments: [
      {
        id: "att-1",
        name: "photo.jpg",
        type: "image/jpeg",
        size: 1024,
        dataUrl: "data:image/jpeg;base64,abc123",
      },
    ],
    updatedAt: Date.now(),
  };

  beforeEach(async () => {
    await clearDraft();
  });

  it("S23: saves and restores draft data correctly", async () => {
    await saveDraft(sampleDraft);
    const loaded = await loadDraft();

    expect(loaded).not.toBeNull();
    expect(loaded?.occurredOn).toBe("2026-08-24");
    expect(loaded?.locationId).toBe(1);
    expect(loaded?.departmentId).toBe(2);
    expect(loaded?.categoryId).toBe(3);
    expect(loaded?.subcategoryId).toBe(4);
    expect(loaded?.description).toBe("Ceci est un brouillon d'incident en cours de rédaction.");
    expect(loaded?.priority).toBe("important");
    expect(loaded?.attachments).toHaveLength(1);
    expect(loaded?.attachments[0].name).toBe("photo.jpg");
  });

  it("S24: clears draft after submission or reset", async () => {
    await saveDraft(sampleDraft);
    let loaded = await loadDraft();
    expect(loaded).not.toBeNull();

    await clearDraft();
    loaded = await loadDraft();
    expect(loaded).toBeNull();
  });
});
