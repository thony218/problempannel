import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById, mapIssueRow } from "../db/issues";
import { insertHistoryEventStatement } from "../db/history";
import {
  insertSimpleReference,
  insertSubcategory as dbInsertSubcategory,
  insertUser as dbInsertUser,
  listAllUsers,
  listReferenceTable,
  mapGenericReferenceRow,
  mapUserRow,
  updateSimpleReference,
  updateSubcategory as dbUpdateSubcategory,
  updateUser as dbUpdateUser,
  type ApiReferenceItem,
  type ApiUser,
  type Role,
} from "../db/admin";

export type ApiIssue = components["schemas"]["Issue"];

function requireAdmin(role: Role): void {
  if (role !== "admin") {
    throw new AppError("FORBIDDEN", "Cette opération est strictement réservée aux administrateurs.");
  }
}

// ----------------------------------------------------
// Utilisateurs
// ----------------------------------------------------

export async function adminListUsers(db: D1Database, actorRole: Role): Promise<ApiUser[]> {
  requireAdmin(actorRole);
  const rows = await listAllUsers(db);
  return rows.map(mapUserRow);
}

export async function adminCreateUser(
  db: D1Database,
  data: {
    email: string;
    displayName: string;
    role: Role;
    active?: boolean;
    defaultLocationId?: number | null;
    defaultDepartmentId?: number | null;
  },
  actorRole: Role
): Promise<ApiUser> {
  requireAdmin(actorRole);

  try {
    const row = await dbInsertUser(db, data);
    return mapUserRow(row);
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      throw new AppError("VALIDATION_ERROR", "Un utilisateur avec cette adresse courriel existe déjà.", {
        email: "Cette adresse courriel est déjà utilisée.",
      });
    }
    throw err;
  }
}

export async function adminUpdateUser(
  db: D1Database,
  userId: number,
  data: {
    displayName?: string;
    role?: Role;
    active?: boolean;
    defaultLocationId?: number | null;
    defaultDepartmentId?: number | null;
  },
  actorRole: Role
): Promise<ApiUser | null> {
  requireAdmin(actorRole);
  const row = await dbUpdateUser(db, userId, data);
  return row ? mapUserRow(row) : null;
}

// ----------------------------------------------------
// Référentiels
// ----------------------------------------------------

export async function adminListReferences(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types" | "subcategories",
  actorRole: Role
): Promise<ApiReferenceItem[]> {
  requireAdmin(actorRole);
  const rows = await listReferenceTable(db, tableName);
  return rows.map(mapGenericReferenceRow);
}

export async function adminCreateReference(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types",
  data: { code: string; label: string; sortOrder?: number },
  actorRole: Role
): Promise<ApiReferenceItem> {
  requireAdmin(actorRole);

  try {
    const row = await insertSimpleReference(db, tableName, data);
    return mapGenericReferenceRow(row);
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      throw new AppError("VALIDATION_ERROR", "Un élément avec ce code existe déjà.", {
        code: "Ce code est déjà utilisé.",
      });
    }
    throw err;
  }
}

export async function adminUpdateReference(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types",
  id: number,
  data: { label?: string; sortOrder?: number; active?: boolean },
  actorRole: Role
): Promise<ApiReferenceItem | null> {
  requireAdmin(actorRole);
  const row = await updateSimpleReference(db, tableName, id, data);
  return row ? mapGenericReferenceRow(row) : null;
}

export async function adminCreateSubcategory(
  db: D1Database,
  data: { categoryId: number; code: string; label: string; sortOrder?: number },
  actorRole: Role
): Promise<ApiReferenceItem> {
  requireAdmin(actorRole);

  try {
    const row = await dbInsertSubcategory(db, data);
    return mapGenericReferenceRow(row);
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      throw new AppError("VALIDATION_ERROR", "Une sous-catégorie avec ce code existe déjà.", {
        code: "Ce code est déjà utilisé.",
      });
    }
    throw err;
  }
}

export async function adminUpdateSubcategory(
  db: D1Database,
  id: number,
  data: { categoryId?: number; label?: string; sortOrder?: number; active?: boolean },
  actorRole: Role
): Promise<ApiReferenceItem | null> {
  requireAdmin(actorRole);
  const row = await dbUpdateSubcategory(db, id, data);
  return row ? mapGenericReferenceRow(row) : null;
}

// ----------------------------------------------------
// Caviardage (V3-PRIV-01)
// ----------------------------------------------------

export async function adminRedactIssue(
  db: D1Database,
  r2: R2Bucket,
  publicId: string,
  data: {
    issueTextFields?: ("description" | "causeSummary" | "immediateSolution" | "permanentCorrectionSummary" | "finalResult" | "preventionLearning")[];
    commentIds?: number[];
    attachmentIds?: number[];
    reason: string;
  },
  actorUserId: number,
  actorRole: Role
): Promise<ApiIssue | null> {
  requireAdmin(actorRole);

  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  const hasTextFields = data.issueTextFields && data.issueTextFields.length > 0;
  const hasComments = data.commentIds && data.commentIds.length > 0;
  const hasAttachments = data.attachmentIds && data.attachmentIds.length > 0;

  if (!hasTextFields && !hasComments && !hasAttachments) {
    throw new AppError("VALIDATION_ERROR", "Au moins une cible de caviardage non vide est obligatoire.", {
      issueTextFields: "Spécifiez au moins un champ texte, un commentaire ou une pièce jointe à caviarder.",
    });
  }

  // 1. Caviarder les champs texte de l'incident
  const fieldMapping: Record<string, string> = {
    description: "description",
    causeSummary: "cause_summary",
    immediateSolution: "immediate_solution",
    permanentCorrectionSummary: "permanent_correction_summary",
    finalResult: "final_result",
    preventionLearning: "prevention_learning",
  };

  const dbUpdates: string[] = [];
  const dbBinds: any[] = [];

  if (hasTextFields) {
    for (const field of data.issueTextFields!) {
      const col = fieldMapping[field];
      if (col) {
        dbUpdates.push(`${col} = '[CAVIARDÉ]'`);
      }
    }
  }

  dbUpdates.push("redacted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  dbUpdates.push("redacted_by_user_id = ?");
  dbBinds.push(actorUserId);
  dbUpdates.push("redaction_reason = ?");
  dbBinds.push(data.reason.trim());
  dbUpdates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  dbUpdates.push("row_version = row_version + 1");
  dbBinds.push(issueId);

  // Exécuter la mise à jour de l'incident
  const updatedIssueRow = await db
    .prepare(`UPDATE issues SET ${dbUpdates.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...dbBinds)
    .first<any>();

  // 2. Caviarder les commentaires ciblés
  if (hasComments) {
    for (const commentId of data.commentIds!) {
      await db
        .prepare(
          `UPDATE comments
           SET body = '[Commentaire caviardé]',
               deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
               deleted_by_user_id = ?,
               delete_reason = ?
           WHERE id = ? AND issue_id = ?`
        )
        .bind(actorUserId, `[CAVIARDÉ] ${data.reason.trim()}`, commentId, issueId)
        .run();
    }
  }

  // 3. Caviarder et purger physiquement les pièces jointes de R2
  if (hasAttachments) {
    for (const attachmentId of data.attachmentIds!) {
      const attRow = await db
        .prepare("SELECT r2_key FROM attachments WHERE id = ? AND issue_id = ?")
        .bind(attachmentId, issueId)
        .first<{ r2_key: string }>();

      if (attRow?.r2_key) {
        await r2.delete(attRow.r2_key).catch(() => {});
      }

      await db
        .prepare(
          `UPDATE attachments
           SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
               deleted_by_user_id = ?,
               delete_reason = ?
           WHERE id = ? AND issue_id = ?`
        )
        .bind(actorUserId, `[CAVIARDÉ] ${data.reason.trim()}`, attachmentId, issueId)
        .run();
    }
  }

  // 4. Consigner l'événement d'historique (sans jamais enregistrer les anciennes valeurs libres)
  await insertHistoryEventStatement(db, issueId, {
    actorUserId,
    eventType: "issue_redacted",
    payload: {
      reason: data.reason.trim(),
      redactedFields: data.issueTextFields || [],
      redactedCommentIds: data.commentIds || [],
      redactedAttachmentIds: data.attachmentIds || [],
    },
  }).run();

  return mapIssueRow(updatedIssueRow);
}
