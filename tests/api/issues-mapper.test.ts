import { describe, expect, it } from "vitest";
import { mapIssueRow, type IssueRow } from "../../worker/db/issues";

function baseRow(overrides: Partial<IssueRow> = {}): IssueRow {
  return {
    id: 42,
    occurred_on: "2026-08-20",
    created_at: "2026-08-20T10:00:00.000Z",
    updated_at: "2026-08-20T10:00:00.000Z",
    row_version: 1,
    created_by_user_id: 1,
    location_id: 2,
    department_id: 3,
    category_id: 4,
    subcategory_id: null,
    description: "Une description de dossier suffisamment longue.",
    priority: "normal",
    status: "new",
    owner_user_id: null,
    due_date: null,
    cause_status: null,
    cause_summary: null,
    immediate_solution: null,
    permanent_correction_type: null,
    permanent_correction_summary: null,
    waiting_on_type: null,
    waiting_on_user_id: null,
    waiting_on_label: null,
    final_result: null,
    prevention_learning: null,
    effectiveness_status: null,
    effectiveness_review_date: null,
    resolved_at: null,
    resolved_by_user_id: null,
    redacted_at: null,
    redacted_by_user_id: null,
    redaction_reason: null,
    ...overrides,
  };
}

describe("mapIssueRow", () => {
  it("derives publicId from id and passes simple fields through", () => {
    const issue = mapIssueRow(baseRow());
    expect(issue.publicId).toBe("INC-000042");
    expect(issue.occurredOn).toBe("2026-08-20");
    expect(issue.locationId).toBe(2);
    expect(issue.description).toContain("description");
    expect(issue.rowVersion).toBe(1);
  });

  it("maps snake_case enum values to their camelCase API form", () => {
    expect(mapIssueRow(baseRow({ status: "in_progress" })).status).toBe("inProgress");
    expect(mapIssueRow(baseRow({ status: "waiting" })).status).toBe("waiting");
    expect(mapIssueRow(baseRow({ status: "resolved" })).status).toBe("resolved");
    expect(mapIssueRow(baseRow({ cause_status: "to_verify" })).causeStatus).toBe("toVerify");
    expect(mapIssueRow(baseRow({ cause_status: "known" })).causeStatus).toBe("known");
    expect(
      mapIssueRow(baseRow({ permanent_correction_type: "system_configuration" }))
        .permanentCorrectionType
    ).toBe("systemConfiguration");
  });

  it("keeps null enum fields as null rather than mapping undefined", () => {
    const issue = mapIssueRow(baseRow());
    expect(issue.causeStatus).toBeNull();
    expect(issue.permanentCorrectionType).toBeNull();
    expect(issue.waitingOn).toBeNull();
  });

  it("composes waitingOn for the internal-user variant", () => {
    const issue = mapIssueRow(
      baseRow({ status: "waiting", waiting_on_type: "user", waiting_on_user_id: 7, waiting_on_label: null })
    );
    expect(issue.waitingOn).toEqual({ type: "user", userId: 7, label: null });
  });

  it("composes waitingOn for the external label variant", () => {
    const issue = mapIssueRow(
      baseRow({
        status: "waiting",
        waiting_on_type: "supplier",
        waiting_on_user_id: null,
        waiting_on_label: "Fournisseur XYZ",
      })
    );
    expect(issue.waitingOn).toEqual({ type: "supplier", userId: null, label: "Fournisseur XYZ" });
  });

  it("passes through redaction and resolution metadata untouched", () => {
    const issue = mapIssueRow(
      baseRow({
        resolved_at: "2026-08-21T00:00:00.000Z",
        resolved_by_user_id: 9,
        redacted_at: "2026-08-22T00:00:00.000Z",
        redacted_by_user_id: 1,
        redaction_reason: "Demande RH — voir 09_CAVIARDAGE_ET_HISTORIQUE",
      })
    );
    expect(issue.resolvedAt).toBe("2026-08-21T00:00:00.000Z");
    expect(issue.resolvedByUserId).toBe(9);
    expect(issue.redactedAt).toBe("2026-08-22T00:00:00.000Z");
    expect(issue.redactionReason).toContain("CAVIARDAGE");
  });
});
