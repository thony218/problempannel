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

export type Role = components["schemas"]["Role"];

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MiB
const MAX_ATTACHMENTS_PER_ISSUE = 10;

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

export async function uploadAttachment(
  db: D1Database,
  bucket: R2Bucket,
  publicId: string,
  file: File,
  actorUserId: number
): Promise<ApiAttachment | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  // 1. Validation de la taille (S20)
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new AppError(
      "FILE_TOO_LARGE",
      `Le fichier dépasse la taille maximale autorisée (${MAX_ATTACHMENT_BYTES} octets / 10 Mo).`
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
  if (currentCount >= MAX_ATTACHMENTS_PER_ISSUE) {
    throw new AppError(
      "ATTACHMENT_LIMIT_REACHED",
      `Limite maximale de ${MAX_ATTACHMENTS_PER_ISSUE} pièces jointes par dossier atteinte.`
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
