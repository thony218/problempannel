import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById } from "../db/issues";
import {
  deleteIssueLink as dbDeleteLink,
  findLinkBetween,
  findLinksByIssueId,
  insertIssueLink,
  mapLinkRow,
  type ApiIssueLink,
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

  const inserted = await insertIssueLink(db, {
    issueId1,
    issueId2,
    createdByUserId: actorUserId,
  });

  // Consigner l'événement d'historique sur les deux dossiers
  await Promise.all([
    insertHistoryEventStatement(db, issueId1, {
      actorUserId,
      eventType: "link_created",
      payload: { relatedPublicId },
    }).run(),
    insertHistoryEventStatement(db, issueId2, {
      actorUserId,
      eventType: "link_created",
      payload: { relatedPublicId: publicId },
    }).run(),
  ]);

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

  await dbDeleteLink(db, issueId1, issueId2);

  // Consigner l'événement d'historique sur les deux dossiers
  await Promise.all([
    insertHistoryEventStatement(db, issueId1, {
      actorUserId,
      eventType: "link_deleted",
      payload: { relatedPublicId },
    }).run(),
    insertHistoryEventStatement(db, issueId2, {
      actorUserId,
      eventType: "link_deleted",
      payload: { relatedPublicId: publicId },
    }).run(),
  ]);

  return true;
}
