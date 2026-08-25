import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById, mapIssueRow, type IssueRow } from "../db/issues";
import { insertHistoryEventStatement } from "../db/history";
import {
  countOtherActiveAdmins,
  findUserRowById,
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

  const current = await findUserRowById(db, userId);
  if (!current) return null;

  // Refuser toute modification qui laisserait l'organisation sans
  // administrateur actif.
  //
  // Sans ce garde-fou, l'écran Administration permet en deux clics de se
  // désactiver ou de se rétrograder : plus aucun compte ne peut alors créer
  // ni promouvoir un utilisateur, et la seule sortie est un accès SQL direct
  // à la base de production. La règle porte sur l'état résultant, pas sur
  // l'identité de l'acteur : elle couvre donc aussi un administrateur qui
  // retirerait les droits du dernier autre administrateur.
  const wasActiveAdmin = current.role === "admin" && current.active === 1;
  const losesAdmin = data.role !== undefined && data.role !== "admin";
  const losesActive = data.active === false;

  if (wasActiveAdmin && (losesAdmin || losesActive)) {
    const remaining = await countOtherActiveAdmins(db, userId);
    if (remaining === 0) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cette modification laisserait l'organisation sans administrateur actif.",
        {
          role: "Nommez d'abord un autre administrateur actif.",
        }
      );
    }
  }

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

  // Toutes les cibles doivent exister et appartenir à ce dossier, vérifié
  // AVANT d'écrire quoi que ce soit.
  //
  // Sans ce contrôle, un `UPDATE ... WHERE id = ? AND issue_id = ?` portant sur
  // un identifiant inconnu ou appartenant à un autre dossier ne touche aucune
  // ligne et l'appel répond quand même 200 : l'administrateur reçoit une
  // confirmation de destruction alors que la donnée visée est toujours en
  // clair. Sur une procédure de droit à l'oubli, c'est le pire mode d'échec
  // possible — l'opération est donc refusée en bloc plutôt qu'appliquée à
  // moitié.
  const missingTargets: Record<string, string> = {};

  if (hasComments) {
    const found = await db
      .prepare(
        `SELECT id FROM comments
         WHERE issue_id = ? AND id IN (${data.commentIds!.map(() => "?").join(", ")})`
      )
      .bind(issueId, ...data.commentIds!)
      .all<{ id: number }>();
    const foundIds = new Set((found.results ?? []).map((r) => r.id));
    const missing = data.commentIds!.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      missingTargets.commentIds = `Commentaire(s) introuvable(s) sur ce dossier : ${missing.join(", ")}.`;
    }
  }

  if (hasAttachments) {
    const found = await db
      .prepare(
        `SELECT id FROM attachments
         WHERE issue_id = ? AND id IN (${data.attachmentIds!.map(() => "?").join(", ")})`
      )
      .bind(issueId, ...data.attachmentIds!)
      .all<{ id: number }>();
    const foundIds = new Set((found.results ?? []).map((r) => r.id));
    const missing = data.attachmentIds!.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      missingTargets.attachmentIds = `Pièce(s) jointe(s) introuvable(s) sur ce dossier : ${missing.join(", ")}.`;
    }
  }

  if (Object.keys(missingTargets).length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Certaines cibles de caviardage n'appartiennent pas à ce dossier. Aucune donnée n'a été modifiée.",
      missingTargets
    );
  }

  // Les clés R2 à purger sont relevées avant toute écriture.
  const r2Keys: string[] = [];
  if (hasAttachments) {
    const rows = await db
      .prepare(
        `SELECT r2_key FROM attachments
         WHERE issue_id = ? AND id IN (${data.attachmentIds!.map(() => "?").join(", ")})`
      )
      .bind(issueId, ...data.attachmentIds!)
      .all<{ r2_key: string }>();
    r2Keys.push(...(rows.results ?? []).map((r) => r.r2_key).filter(Boolean));
  }

  // Ordre délibéré : R2 d'abord, base ensuite.
  //
  // Si la purge R2 échoue, rien n'a encore été écrit et l'appel échoue sans
  // laisser de trace mensongère. Si c'est l'écriture en base qui échoue, les
  // fichiers sont partis mais les lignes ne sont pas marquées : l'opérateur
  // rejoue la procédure, `R2.delete` sur une clé absente étant sans effet.
  // L'inverse — marquer en base puis échouer sur R2 — produirait un dossier
  // déclaré caviardé avec ses fichiers toujours dans le bucket.
  for (const key of r2Keys) {
    await r2.delete(key);
  }

  const fieldMapping: Record<string, string> = {
    description: "description",
    causeSummary: "cause_summary",
    immediateSolution: "immediate_solution",
    permanentCorrectionSummary: "permanent_correction_summary",
    finalResult: "final_result",
    preventionLearning: "prevention_learning",
  };

  const dbUpdates: string[] = [];
  const dbBinds: (string | number)[] = [];

  if (hasTextFields) {
    for (const field of data.issueTextFields!) {
      const col = fieldMapping[field];
      if (col) {
        dbUpdates.push(`${col} = '[CAVIARDÉ]'`);
      }
    }
  }

  const reason = data.reason.trim();

  dbUpdates.push("redacted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  dbUpdates.push("redacted_by_user_id = ?");
  dbBinds.push(actorUserId);
  dbUpdates.push("redaction_reason = ?");
  dbBinds.push(reason);
  dbUpdates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  dbUpdates.push("row_version = row_version + 1");
  dbBinds.push(issueId);

  // Toutes les écritures en base dans une seule transaction : une panne en
  // cours de procédure ne doit pas laisser un dossier *partiellement*
  // caviardé — certains champs neutralisés, d'autres encore en clair, sans
  // que rien ne signale l'état intermédiaire.
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE issues SET ${dbUpdates.join(", ")} WHERE id = ? RETURNING *`).bind(...dbBinds),
  ];

  if (hasComments) {
    for (const commentId of data.commentIds!) {
      statements.push(
        db
          .prepare(
            `UPDATE comments
             SET body = '[Commentaire caviardé]',
                 deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 deleted_by_user_id = ?,
                 delete_reason = ?
             WHERE id = ? AND issue_id = ?`
          )
          .bind(actorUserId, `[CAVIARDÉ] ${reason}`, commentId, issueId)
      );
    }
  }

  if (hasAttachments) {
    for (const attachmentId of data.attachmentIds!) {
      statements.push(
        db
          .prepare(
            `UPDATE attachments
             SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 deleted_by_user_id = ?,
                 delete_reason = ?
             WHERE id = ? AND issue_id = ?`
          )
          .bind(actorUserId, `[CAVIARDÉ] ${reason}`, attachmentId, issueId)
      );
    }
  }

  // Le motif et les cibles sont des métadonnées de l'opération, jamais les
  // anciennes valeurs libres (01_produit/09_CAVIARDAGE_ET_HISTORIQUE.md).
  statements.push(
    insertHistoryEventStatement(db, issueId, {
      actorUserId,
      eventType: "issue_redacted",
      payload: {
        reason,
        redactedFields: data.issueTextFields ?? [],
        redactedCommentIds: data.commentIds ?? [],
        redactedAttachmentIds: data.attachmentIds ?? [],
      },
    })
  );

  const results = await db.batch<IssueRow>(statements);
  const updatedIssueRow = results[0]?.results?.[0];
  if (!updatedIssueRow) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return mapIssueRow(updatedIssueRow);
}
