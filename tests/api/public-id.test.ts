import { describe, expect, it } from "vitest";
import { parsePublicId, toPublicId } from "../../worker/domain/publicId";

describe("toPublicId", () => {
  it("pads ids under 6 digits with leading zeros", () => {
    expect(toPublicId(1)).toBe("INC-000001");
    expect(toPublicId(42)).toBe("INC-000042");
    expect(toPublicId(999999)).toBe("INC-999999");
  });

  it("does not truncate ids at or above 6 digits", () => {
    expect(toPublicId(1000000)).toBe("INC-1000000");
  });
});

describe("parsePublicId", () => {
  it("round-trips ids produced by toPublicId", () => {
    for (const id of [1, 42, 100000, 999999, 1000000, 123456789]) {
      expect(parsePublicId(toPublicId(id))).toBe(id);
    }
  });

  it("rejects a non-canonical padding variant of a valid id", () => {
    // INC-000042 is canonical for id 42; an extra digit of padding must
    // not resolve to the same issue (V4-ID-01: strict resolution).
    expect(parsePublicId("INC-0000042")).toBeNull();
  });

  it("rejects fewer than 6 digits", () => {
    expect(parsePublicId("INC-42")).toBeNull();
    expect(parsePublicId("INC-00042")).toBeNull();
  });

  it("rejects non-numeric or malformed input", () => {
    expect(parsePublicId("INC-00004A")).toBeNull();
    expect(parsePublicId("inc-000042")).toBeNull();
    expect(parsePublicId("000042")).toBeNull();
    expect(parsePublicId("INC-")).toBeNull();
    expect(parsePublicId("")).toBeNull();
  });

  it("rejects id 0 and negative-looking input", () => {
    expect(parsePublicId("INC-000000")).toBeNull();
    expect(parsePublicId("INC--00042")).toBeNull();
  });
});
