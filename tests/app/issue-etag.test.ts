import { describe, expect, it } from "vitest";
import { issueEtag, responseIssueEtag } from "../../src/shared/issueEtag";

describe("ETag de dossier", () => {
  it("builds a quoted strong entity tag", () => {
    expect(issueEtag("INC-000001", 3)).toBe('"issue-1-v3"');
  });

  it("uses the response header when it is a valid strong ETag", () => {
    expect(responseIssueEtag('"issue-1-v4"', "INC-000001", 4)).toBe('"issue-1-v4"');
  });

  it("falls back to the response body when a proxy removes or weakens the header", () => {
    expect(responseIssueEtag(null, "INC-000001", 5)).toBe('"issue-1-v5"');
    expect(responseIssueEtag('W/"issue-1-v5"', "INC-000001", 5)).toBe('"issue-1-v5"');
    expect(responseIssueEtag("malformed", "INC-000001", 5)).toBe('"issue-1-v5"');
  });
});
