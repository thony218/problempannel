import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { rateLimit } from "../auth/rateLimit";
import { AppError, okBody } from "../domain/errors";
import { appConfigFromEnv } from "../domain/config";

import {
  deleteAttachment,
  getAttachmentForDownload,
  listAttachments,
  uploadAttachment,
} from "../services/attachments";

export const attachmentRoutes = new Hono<AppEnv>();

/**
 * En-têtes de la réponse binaire d'une pièce jointe.
 *
 * - `nosniff` empêche le navigateur de requalifier le contenu en un type plus
 *   dangereux que celui déclaré (le type MIME vient du client à l'envoi, il
 *   n'est pas prouvé par une lecture des octets d'en-tête du fichier).
 * - `Content-Security-Policy: sandbox` neutralise tout script d'un document
 *   affiché en ligne (un PDF peut en embarquer), servi ici depuis l'origine
 *   même de l'application.
 * - Le nom de fichier est fourni deux fois : une version ASCII sûre pour les
 *   clients anciens, puis `filename*` en UTF-8 percent-encodé (RFC 5987) qui
 *   préserve les accents. Les retours chariot sont retirés : `Headers.set()`
 *   lève une TypeError sur une valeur qui en contient, ce qui transformerait
 *   un simple téléchargement en 500.
 */
function downloadHeaders(contentType: string, originalName: string, sizeBytes: number): Headers {
  const asciiName = originalName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(originalName).replace(/[\r\n]/g, "");

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(sizeBytes));
  headers.set("Content-Disposition", `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
  return headers;
}


attachmentRoutes.get("/issues/:publicId/attachments", requireUser, async (c) => {
  const items = await listAttachments(c.env.DB, c.req.param("publicId"));
  if (!items) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  return c.json(okBody(items));
});

attachmentRoutes.post("/issues/:publicId/attachments", requireUser, rateLimit("upload"), async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Données de formulaire invalides.", {
      file: "Fichier requis (multipart/form-data).",
    });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || !(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", "Données invalides.", {
      file: "Le champ 'file' est obligatoire et doit être un fichier.",
    });
  }

  const user = c.get("user");
  const attachment = await uploadAttachment(
    c.env.DB,
    c.env.ATTACHMENTS,
    c.req.param("publicId"),
    file,
    user.id,
    appConfigFromEnv(c.env)
  );

  if (!attachment) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(attachment), 201);
});

attachmentRoutes.get("/attachments/:attachmentId", requireUser, async (c) => {
  const attachmentId = Number(c.req.param("attachmentId"));
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new AppError("NOT_FOUND", "Pièce jointe introuvable.");
  }

  const result = await getAttachmentForDownload(c.env.DB, c.env.ATTACHMENTS, attachmentId);
  if (!result) {
    throw new AppError("NOT_FOUND", "Pièce jointe introuvable.");
  }

  return new Response(result.r2Object.body, {
    status: 200,
    headers: downloadHeaders(result.row.content_type, result.row.original_name, result.row.size_bytes),
  });
});

attachmentRoutes.delete("/attachments/:attachmentId", requireUser, rateLimit("write"), async (c) => {
  const attachmentId = Number(c.req.param("attachmentId"));
  if (!Number.isInteger(attachmentId) || attachmentId <= 0) {
    throw new AppError("NOT_FOUND", "Pièce jointe introuvable.");
  }

  const user = c.get("user");
  const deleted = await deleteAttachment(c.env.DB, attachmentId, user.id, user.role);
  if (!deleted) {
    throw new AppError("NOT_FOUND", "Pièce jointe introuvable.");
  }

  return c.body(null, 204);
});
