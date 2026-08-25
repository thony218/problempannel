import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { findIssueRowById } from "../db/issues";
import {
  countActiveAttachmentsByIssueId,
  findActiveAttachmentsByIssueId,
  findAttachmentById,
  insertAttachment,
  mapAttachmentRow,
  softDeleteAttachment,
  type ApiAttachment,
  type AttachmentRow,
} from "../db/attachments";
import { insertHistoryEventStatement } from "../db/history";
import type { AppConfig } from "../domain/config";

export type Role = components["schemas"]["Role"];

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function listAttachments(
  db: D1Database,
  publicId: string
): Promise<ApiAttachment[] | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  const rows = await findActiveAttachmentsByIssueId(db, issueId);
  return rows.map(mapAttachmentRow);
}

/**
 * Les limites viennent de la configuration Worker (`AppConfig`), la même que
 * celle publiée par `/api/meta` — jamais de constante locale, sinon le serveur
 * refuserait à 10 Mo un fichier que le client croit autorisé à 20 Mo (S20/S22).
 */
export async function uploadAttachment(
  db: D1Database,
  bucket: R2Bucket,
  publicId: string,
  file: File,
  actorUserId: number,
  config: Pick<AppConfig, "maxAttachmentBytes" | "maxAttachmentsPerIssue">
): Promise<ApiAttachment | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  // 1. Validation de la taille (S20)
  if (file.size > config.maxAttachmentBytes) {
    const maxMegabytes = Math.round(config.maxAttachmentBytes / (1024 * 1024));
    throw new AppError(
      "FILE_TOO_LARGE",
      `Le fichier dépasse la taille maximale autorisée (${config.maxAttachmentBytes} octets / ${maxMegabytes} Mo).`
    );
  }

  // 2. Validation du type MIME (S17-S19, S21)
  const contentType = file.type.toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new AppError(
      "UNSUPPORTED_FILE_TYPE",
      `Type de fichier non autorisé (${file.type}). Types acceptés : JPEG, PNG, WebP, HEIC, HEIF, PDF.`
    );
  }

  // 3. Validation du quota par issue (S22)
  const currentCount = await countActiveAttachmentsByIssueId(db, issueId);
  if (currentCount >= config.maxAttachmentsPerIssue) {
    throw new AppError(
      "ATTACHMENT_LIMIT_REACHED",
      `Limite maximale de ${config.maxAttachmentsPerIssue} pièces jointes par dossier atteinte.`
    );
  }

  // 4. Téléversement dans R2
  const r2Key = `issues/${issueId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const fileArrayBuffer = await file.arrayBuffer();

  await bucket.put(r2Key, fileArrayBuffer, {
    httpMetadata: {
      contentType: file.type,
    },
  });

  // 5. Enregistrement en base D1
  const inserted = await insertAttachment(db, {
    issueId,
    uploadedByUserId: actorUserId,
    originalName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    r2Key,
  });

  // 6. Enregistrement de l'événement d'historique
  await insertHistoryEventStatement(db, issueId, {
    actorUserId,
    eventType: "attachment_uploaded",
    payload: { attachmentId: inserted.id, originalName: file.name, sizeBytes: file.size },
  }).run();

  return mapAttachmentRow(inserted);
}

export async function getAttachmentForDownload(
  db: D1Database,
  bucket: R2Bucket,
  attachmentId: number
): Promise<{ row: AttachmentRow; r2Object: R2ObjectBody } | null> {
  const row = await findAttachmentById(db, attachmentId);
  if (!row || row.deleted_at !== null) {
    return null;
  }

  const r2Object = await bucket.get(row.r2_key);
  if (!r2Object) {
    return null;
  }

  return { row, r2Object };
}

export async function deleteAttachment(
  db: D1Database,
  attachmentId: number,
  actorUserId: number,
  actorRole: Role
): Promise<boolean | null> {
  const row = await findAttachmentById(db, attachmentId);
  if (!row || row.deleted_at !== null) {
    return null;
  }

  // 01_produit/04_MATRICE_PERMISSIONS.md : Soft-delete PJ réservé à manager et admin
  if (actorRole !== "manager" && actorRole !== "admin") {
    throw new AppError("FORBIDDEN", "Seuls les gestionnaires et administrateurs peuvent supprimer une pièce jointe.");
  }

  await softDeleteAttachment(db, {
    attachmentId,
    deletedByUserId: actorUserId,
  });

  // Consigner l'événement d'historique
  await insertHistoryEventStatement(db, row.issue_id, {
    actorUserId,
    eventType: "attachment_deleted",
    payload: { attachmentId },
  }).run();

  return true;
}
