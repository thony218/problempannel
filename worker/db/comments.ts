import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiComment = components["schemas"]["Comment"];

export interface CommentRow {
  id: number;
  issue_id: number;
  user_id: number;
  body: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  delete_reason: string | null;
  redacted_at: string | null;
  redacted_by_user_id: number | null;
  redaction_reason: string | null;
}

export function mapCommentRow(row: CommentRow): ApiComment {
  const isDeleted = row.deleted_at !== null;
  return {
    id: row.id,
    issuePublicId: toPublicId(row.issue_id),
    userId: row.user_id,
    body: isDeleted ? null : row.body,
    createdAt: row.created_at,
    deleted: isDeleted,
    deletedAt: row.deleted_at,
    redactedAt: row.redacted_at,
  };
}

export async function findCommentsByIssueId(
  db: D1Database,
  issueId: number,
  params: { cursorId?: number; limit: number }
): Promise<{ rows: CommentRow[]; hasMore: boolean; nextCursorId: number | null }> {
  const { cursorId, limit } = params;
  let query = `
    SELECT id, issue_id, user_id, body, created_at, deleted_at, deleted_by_user_id, delete_reason,
           redacted_at, redacted_by_user_id, redaction_reason
    FROM comments
    WHERE issue_id = ?
  `;
  const binds: (number | string)[] = [issueId];

  if (cursorId !== undefined) {
    query += " AND id > ?";
    binds.push(cursorId);
  }

  query += " ORDER BY id ASC LIMIT ?";
  binds.push(limit + 1);

  const result = await db.prepare(query).bind(...binds).all<CommentRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const slicedRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursorId = hasMore && slicedRows.length > 0 ? slicedRows[slicedRows.length - 1].id : null;

  return { rows: slicedRows, hasMore, nextCursorId };
}

export async function findCommentById(db: D1Database, id: number): Promise<CommentRow | null> {
  const result = await db
    .prepare(
      `SELECT id, issue_id, user_id, body, created_at, deleted_at, deleted_by_user_id, delete_reason,
              redacted_at, redacted_by_user_id, redaction_reason
       FROM comments WHERE id = ?`
    )
    .bind(id)
    .first<CommentRow>();
  return result || null;
}

export async function insertComment(
  db: D1Database,
  data: { issueId: number; userId: number; body: string }
): Promise<CommentRow> {
  const result = await db
    .prepare(
      `INSERT INTO comments (issue_id, user_id, body)
       VALUES (?, ?, ?)
       RETURNING id, issue_id, user_id, body, created_at, deleted_at, deleted_by_user_id, delete_reason,
                 redacted_at, redacted_by_user_id, redaction_reason`
    )
    .bind(data.issueId, data.userId, data.body)
    .first<CommentRow>();

  if (!result) {
    throw new Error("Échec de l'insertion du commentaire.");
  }
  return result;
}

export async function softDeleteComment(
  db: D1Database,
  data: { commentId: number; deletedByUserId: number; deleteReason: string }
): Promise<void> {
  await db
    .prepare(
      `UPDATE comments
       SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           deleted_by_user_id = ?,
           delete_reason = ?
       WHERE id = ?`
    )
    .bind(data.deletedByUserId, data.deleteReason, data.commentId)
    .run();
}
