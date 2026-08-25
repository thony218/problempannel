import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiIssueLink = components["schemas"]["IssueLink"];

export interface IssueLinkRow {
  id: number;
  issue_id_a: number;
  issue_id_b: number;
  link_type: string;
  created_by_user_id: number;
  created_at: string;
}

export function mapLinkRow(row: IssueLinkRow, currentIssueId: number): ApiIssueLink {
  const relatedIssueId = row.issue_id_a === currentIssueId ? row.issue_id_b : row.issue_id_a;
  return {
    relatedPublicId: toPublicId(relatedIssueId),
    linkType: "similar",
    createdAt: row.created_at,
  };
}

export async function findLinksByIssueId(
  db: D1Database,
  issueId: number
): Promise<IssueLinkRow[]> {
  const result = await db
    .prepare(
      `SELECT id, issue_id_a, issue_id_b, link_type, created_by_user_id, created_at
       FROM issue_links
       WHERE issue_id_a = ? OR issue_id_b = ?
       ORDER BY id ASC`
    )
    .bind(issueId, issueId)
    .all<IssueLinkRow>();

  return result.results || [];
}

export async function findLinkBetween(
  db: D1Database,
  issueId1: number,
  issueId2: number
): Promise<IssueLinkRow | null> {
  const [a, b] = issueId1 < issueId2 ? [issueId1, issueId2] : [issueId2, issueId1];
  const result = await db
    .prepare(
      `SELECT id, issue_id_a, issue_id_b, link_type, created_by_user_id, created_at
       FROM issue_links
       WHERE issue_id_a = ? AND issue_id_b = ?`
    )
    .bind(a, b)
    .first<IssueLinkRow>();

  return result || null;
}

export async function insertIssueLink(
  db: D1Database,
  data: {
    issueId1: number;
    issueId2: number;
    createdByUserId: number;
  }
): Promise<IssueLinkRow> {
  const [a, b] = data.issueId1 < data.issueId2 ? [data.issueId1, data.issueId2] : [data.issueId2, data.issueId1];

  const result = await db
    .prepare(
      `INSERT INTO issue_links (issue_id_a, issue_id_b, link_type, created_by_user_id)
       VALUES (?, ?, 'similar', ?)
       RETURNING id, issue_id_a, issue_id_b, link_type, created_by_user_id, created_at`
    )
    .bind(a, b, data.createdByUserId)
    .first<IssueLinkRow>();

  if (!result) {
    throw new Error("Échec de l'insertion du lien.");
  }
  return result;
}

export async function deleteIssueLink(
  db: D1Database,
  issueId1: number,
  issueId2: number
): Promise<void> {
  const [a, b] = issueId1 < issueId2 ? [issueId1, issueId2] : [issueId2, issueId1];
  await db
    .prepare("DELETE FROM issue_links WHERE issue_id_a = ? AND issue_id_b = ?")
    .bind(a, b)
    .run();
}
