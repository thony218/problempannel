import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiAttachment = components["schemas"]["Attachment"];

export interface AttachmentRow {
  id: number;
  issue_id: number;
  uploaded_by_user_id: number;
  original_name: string;
  content_type: string;
  size_bytes: number;
  r2_key: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by_user_id: number | null;
  delete_reason: string | null;
}

export function mapAttachmentRow(row: AttachmentRow): ApiAttachment {
  return {
    id: row.id,
    issuePublicId: toPublicId(row.issue_id),
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: row.created_at,
  };
}

export async function findActiveAttachmentsByIssueId(
  db: D1Database,
  issueId: number
): Promise<AttachmentRow[]> {
  const result = await db
    .prepare(
      `SELECT id, issue_id, uploaded_by_user_id, original_name, content_type, size_bytes,
              r2_key, created_at, deleted_at, deleted_by_user_id, delete_reason
       FROM attachments
       WHERE issue_id = ? AND deleted_at IS NULL
       ORDER BY id ASC`
    )
    .bind(issueId)
    .all<AttachmentRow>();
  return result.results || [];
}

export async function countActiveAttachmentsByIssueId(
  db: D1Database,
  issueId: number
): Promise<number> {
  const result = await db
    .prepare(
      "SELECT COUNT(*) as count FROM attachments WHERE issue_id = ? AND deleted_at IS NULL"
    )
    .bind(issueId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function findAttachmentById(
  db: D1Database,
  id: number
): Promise<AttachmentRow | null> {
  const result = await db
    .prepare(
      `SELECT id, issue_id, uploaded_by_user_id, original_name, content_type, size_bytes,
              r2_key, created_at, deleted_at, deleted_by_user_id, delete_reason
       FROM attachments WHERE id = ?`
    )
    .bind(id)
    .first<AttachmentRow>();
  return result || null;
}

/** Statement d'insertion, à grouper avec son événement d'historique (G-007). */
export function insertAttachmentStatement(
  db: D1Database,
  data: {
    issueId: number;
    uploadedByUserId: number;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    r2Key: string;
  }
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO attachments (issue_id, uploaded_by_user_id, original_name, content_type, size_bytes, r2_key)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING id, issue_id, uploaded_by_user_id, original_name, content_type, size_bytes,
                 r2_key, created_at, deleted_at, deleted_by_user_id, delete_reason`
    )
    .bind(
      data.issueId,
      data.uploadedByUserId,
      data.originalName,
      data.contentType,
      data.sizeBytes,
      data.r2Key
    );
}

/** Statement de soft-delete, à grouper avec son événement d'historique (G-007). */
export function softDeleteAttachmentStatement(
  db: D1Database,
  data: { attachmentId: number; deletedByUserId: number; deleteReason?: string | null }
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE attachments
       SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           deleted_by_user_id = ?,
           delete_reason = ?
       WHERE id = ?`
    )
    .bind(data.deletedByUserId, data.deleteReason ?? null, data.attachmentId);
}
