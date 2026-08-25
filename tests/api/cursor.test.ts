import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../../worker/domain/cursor";

describe("worker/domain/cursor", () => {
  it("encodes and decodes an issue cursor round-trip", () => {
    const original = { id: 42 };
    const encoded = encodeCursor(original);
    expect(typeof encoded).toBe("string");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");

    const decoded = decodeCursor(encoded);
    expect(decoded).toEqual(original);
  });

  it("handles various positive integer IDs", () => {
    for (const id of [1, 100, 999999, 123456789]) {
      const encoded = encodeCursor({ id });
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual({ id });
    }
  });

  it("round-trips composite sort cursors", () => {
    expect(decodeCursor(encodeCursor({ id: 8, sort: "priority", sortKey: 3 }))).toEqual({
      id: 8,
      sort: "priority",
      sortKey: 3,
    });
    expect(decodeCursor(encodeCursor({ id: 9, sort: "dueDate", sortKey: "2026-09-01" }))).toEqual({
      id: 9,
      sort: "dueDate",
      sortKey: "2026-09-01",
    });
    expect(decodeCursor(encodeCursor({ id: 10, sort: "dueDate", sortKey: null }))).toEqual({
      id: 10,
      sort: "dueDate",
      sortKey: null,
    });
  });

  it("returns null for invalid or corrupted cursors", () => {
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("   ")).toBeNull();
    expect(decodeCursor("not-base64-!@#$%")).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({})) )).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ id: "string" })) )).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ id: 0 })) )).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ id: -5 })) )).toBeNull();
    expect(decodeCursor(btoa(JSON.stringify({ id: 1.5 })) )).toBeNull();
  });
});
