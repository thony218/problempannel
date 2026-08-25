import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById } from "../db/issues";
import {
  deleteIssueLinkStatement,
  findLinkBetween,
  findLinksByIssueId,
  insertIssueLinkStatement,
  mapLinkRow,
  type ApiIssueLink,
  type IssueLinkRow,
} from "../db/links";
import { insertHistoryEventStatement } from "../db/history";

export type Role = components["schemas"]["Role"];

export async function listLinks(
  db: D1Database,
  publicId: string
): Promise<ApiIssueLink[] | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  const rows = await findLinksByIssueId(db, issueId);
  return rows.map((r) => mapLinkRow(r, issueId));
}

export async function createLink(
  db: D1Database,
  publicId: string,
  relatedPublicId: string,
  actorUserId: number,
  actorRole: Role
): Promise<ApiIssueLink | null> {
  // 01_produit/04_MATRICE_PERMISSIONS.md : Lier similar réservé à manager et admin
  if (actorRole !== "manager" && actorRole !== "admin") {
    throw new AppError(
      "FORBIDDEN",
      "Seuls les gestionnaires et administrateurs peuvent lier des dossiers similaires."
    );
  }

  const issueId1 = parsePublicId(publicId);
  const issueId2 = parsePublicId(relatedPublicId);
  if (issueId1 === null || issueId2 === null) {
    return null;
  }

  if (issueId1 === issueId2) {
    throw new AppError("VALIDATION_ERROR", "Données invalides.", {
      relatedPublicId: "Un dossier ne peut pas être lié à lui-même.",
    });
  }

  const [issue1, issue2] = await Promise.all([
    findIssueRowById(db, issueId1),
    findIssueRowById(db, issueId2),
  ]);

  if (!issue1 || !issue2) {
    return null;
  }

  const existing = await findLinkBetween(db, issueId1, issueId2);
  if (existing) {
    throw new AppError("CONFLICT", "Ces deux dossiers sont déjà liés.");
  }

  // Le lien et les deux événements d'historique dans une seule transaction :
  // une liaison ne doit jamais apparaître dans l'historique d'un seul des deux
  // dossiers (G-007).
  const results = await db.batch<IssueLinkRow>([
    insertIssueLinkStatement(db, { issueId1, issueId2, createdByUserId: actorUserId }),
    insertHistoryEventStatement(db, issueId1, {
      actorUserId,
      eventType: "link_created",
      payload: { relatedPublicId },
    }),
    insertHistoryEventStatement(db, issueId2, {
      actorUserId,
      eventType: "link_created",
      payload: { relatedPublicId: publicId },
    }),
  ]);

  const inserted = results[0]?.results?.[0];
  if (!inserted) {
    throw new Error("Échec de l'insertion du lien.");
  }
  return mapLinkRow(inserted, issueId1);
}

export async function removeLink(
  db: D1Database,
  publicId: string,
  relatedPublicId: string,
  actorUserId: number,
  actorRole: Role
): Promise<boolean | null> {
  // 01_produit/04_MATRICE_PERMISSIONS.md : Lier similar réservé à manager et admin
  if (actorRole !== "manager" && actorRole !== "admin") {
    throw new AppError(
      "FORBIDDEN",
      "Seuls les gestionnaires et administrateurs peuvent retirer une liaison entre dossiers."
    );
  }

  const issueId1 = parsePublicId(publicId);
  const issueId2 = parsePublicId(relatedPublicId);
  if (issueId1 === null || issueId2 === null) {
    return null;
  }

  const existing = await findLinkBetween(db, issueId1, issueId2);
  if (!existing) {
    return null;
  }

  await db.batch([
    deleteIssueLinkStatement(db, issueId1, issueId2),
    insertHistoryEventStatement(db, issueId1, {
      actorUserId,
      eventType: "link_deleted",
      payload: { relatedPublicId },
    }),
    insertHistoryEventStatement(db, issueId2, {
      actorUserId,
      eventType: "link_deleted",
      payload: { relatedPublicId: publicId },
    }),
  ]);

  return true;
}
