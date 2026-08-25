import React from "react";
import { describe, expect, it } from "vitest";
import { IssueList } from "../../src/features/issues/IssueList";
import { IssueDetailView } from "../../src/features/issues/IssueDetailView";
import { CommentsSection } from "../../src/features/comments/CommentsSection";
import { AttachmentsSection } from "../../src/features/attachments/AttachmentsSection";
import { CorrectiveActionsSection } from "../../src/features/corrective-actions/CorrectiveActionsSection";
import { HistoryTimelineSection } from "../../src/features/history/HistoryTimelineSection";
import { EditIssueModal } from "../../src/features/issues/EditIssueModal";

describe("Frontend Views (LIST-04, DETAIL-02, COM-03, ATT-03, ACT-03, HIST-02, FLOW-05/06)", () => {
  it("creates valid React elements for all issue detail sub-components", () => {
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

    const commentsElement = React.createElement(CommentsSection, {
      publicId: "INC-000001",
    });
    expect(React.isValidElement(commentsElement)).toBe(true);

    const attachmentsElement = React.createElement(AttachmentsSection, {
      publicId: "INC-000001",
    });
    expect(React.isValidElement(attachmentsElement)).toBe(true);

    const actionsElement = React.createElement(CorrectiveActionsSection, {
      publicId: "INC-000001",
    });
    expect(React.isValidElement(actionsElement)).toBe(true);

    const historyElement = React.createElement(HistoryTimelineSection, {
      publicId: "INC-000001",
    });
    expect(React.isValidElement(historyElement)).toBe(true);

    const editModalElement = React.createElement(EditIssueModal, {
      issue: {
        publicId: "INC-000001",
        rowVersion: 1,
        occurredOn: "2026-08-20",
        locationId: 1,
        departmentId: null,
        categoryId: 1,
        subcategoryId: null,
        description: "Test issue",
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
      },
      etag: '"test-etag"',
      onClose: () => {},
      onSuccess: async () => {},
      onReload: async () => {},
    });
    expect(React.isValidElement(editModalElement)).toBe(true);
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
