import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { decodeCursor, encodeCursor } from "../domain/cursor";
import { findIssueRowById } from "../db/issues";
import {
  findCommentById,
  findCommentsByIssueId,
  insertCommentStatement,
  mapCommentRow,
  softDeleteCommentStatement,
  type ApiComment,
  type CommentRow,
} from "../db/comments";
import {
  insertHistoryEventForJustCreatedChildStatement,
  insertHistoryEventStatement,
} from "../db/history";
import type { CreateCommentInput, DeleteCommentInput, ListCommentsQuery } from "../validation/comments";

export type Role = components["schemas"]["Role"];

export interface CommentListResult {
  items: ApiComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function listComments(
  db: D1Database,
  publicId: string,
  query: ListCommentsQuery
): Promise<CommentListResult | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  let cursorId: number | undefined;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (!decoded) {
      throw new AppError("BAD_REQUEST", "Curseur de pagination invalide.");
    }
    cursorId = decoded.id;
  }

  const { rows, hasMore, nextCursorId } = await findCommentsByIssueId(db, issueId, {
    cursorId,
    limit: query.limit,
  });

  const nextCursor = nextCursorId ? encodeCursor({ id: nextCursorId }) : null;

  return {
    items: rows.map(mapCommentRow),
    nextCursor,
    hasMore,
  };
}

export async function createComment(
  db: D1Database,
  publicId: string,
  input: CreateCommentInput,
  actorUserId: number
): Promise<ApiComment | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  // Le commentaire et sa trace d'audit dans une seule transaction (G-007) :
  // une panne entre les deux écritures laisserait un commentaire sans
  // événement correspondant dans l'historique du dossier.
  const results = await db.batch<CommentRow>([
    insertCommentStatement(db, { issueId, userId: actorUserId, body: input.body.trim() }),
    insertHistoryEventForJustCreatedChildStatement(
      db,
      issueId,
      { actorUserId, eventType: "comment_created", idPayloadKey: "commentId" },
      "comments"
    ),
  ]);

  const created = results[0]?.results?.[0];
  if (!created) {
    throw new Error("Échec de l'insertion du commentaire.");
  }
  return mapCommentRow(created);
}

export async function deleteComment(
  db: D1Database,
  commentId: number,
  input: DeleteCommentInput,
  actorUserId: number,
  actorRole: Role
): Promise<boolean | null> {
  const comment = await findCommentById(db, commentId);
  // Un commentaire déjà supprimé est traité comme introuvable (404) : le
  // re-supprimer écraserait l'auteur/le motif d'origine et empilerait un
  // second événement `comment_deleted` (G-007, historique append-only).
  // Même contrat que `deleteAttachment`.
  if (!comment || comment.deleted_at !== null) return null;

  // 01_produit/04_MATRICE_PERMISSIONS.md : Soft-delete commentaire réservé aux manager et admin
  if (actorRole !== "manager" && actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Seuls les gestionnaires et administrateurs peuvent supprimer un commentaire.");
  }

  await db.batch([
    softDeleteCommentStatement(db, {
      commentId,
      deletedByUserId: actorUserId,
      deleteReason: input.reason.trim(),
    }),
    insertHistoryEventStatement(db, comment.issue_id, {
      actorUserId,
      eventType: "comment_deleted",
      payload: { commentId },
    }),
  ]);

  return true;
}
