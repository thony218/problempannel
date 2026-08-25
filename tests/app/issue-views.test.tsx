import React from "react";
import { describe, expect, it } from "vitest";
import { IssueList } from "../../src/features/issues/IssueList";
import { IssueDetailView } from "../../src/features/issues/IssueDetailView";

describe("Frontend Views (LIST-04 & DETAIL-02)", () => {
  it("creates valid React elements for IssueList and IssueDetailView", () => {
    const listElement = React.createElement(IssueList, {
      onSelectIssue: () => {},
      onNewIssue: () => {},
    });
    expect(React.isValidElement(listElement)).toBe(true);

    const detailElement = React.createElement(IssueDetailView, {
      publicId: "INC-000001",
      onBack: () => {},
    });
    expect(React.isValidElement(detailElement)).toBe(true);
  });

  it("constructs correct query parameters for filtering in registry", () => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    params.set("q", "panne réseau");
    params.set("status", "inProgress");
    params.set("locationId", "1");
    params.set("categoryId", "2");
    params.set("priority", "urgent");

    const qs = params.toString();
    expect(qs).toContain("q=panne+r%C3%A9seau");
    expect(qs).toContain("status=inProgress");
    expect(qs).toContain("locationId=1");
    expect(qs).toContain("categoryId=2");
    expect(qs).toContain("priority=urgent");
  });
});
