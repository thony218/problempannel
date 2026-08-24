import type { components } from "../../src/shared/api-types.generated";

export type ApiImpact = components["schemas"]["Impact"];

interface ImpactRow {
  id: number;
  impact_type_id: number;
  details: string | null;
}

export async function findImpactsByIssueId(db: D1Database, issueId: number): Promise<ApiImpact[]> {
  const result = await db
    .prepare("SELECT id, impact_type_id, details FROM issue_impacts WHERE issue_id = ? ORDER BY id ASC")
    .bind(issueId)
    .all<ImpactRow>();

  return (result.results || []).map((row) => ({
    id: row.id,
    impactTypeId: row.impact_type_id,
    details: row.details,
  }));
}
