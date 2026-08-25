import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";

import {
  deleteAttachment,
  getAttachmentForDownload,
  listAttachments,
  uploadAttachment,
} from "../services/attachments";

export const attachmentRoutes = new Hono<AppEnv>();

attachmentRoutes.get("/issues/:publicId/attachments", requireUser, async (c) => {
  const items = await listAttachments(c.env.DB, c.req.param("publicId"));
  if (!items) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  return c.json(okBody(items));
});

attachmentRoutes.post("/issues/:publicId/attachments", requireUser, async (c) => {
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
    user.id
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

  const headers = new Headers();
  headers.set("Content-Type", result.row.content_type);
  headers.set("Content-Disposition", `inline; filename="${result.row.original_name.replace(/"/g, "")}"`);
  headers.set("Content-Length", String(result.row.size_bytes));

  return new Response(result.r2Object.body, {
    status: 200,
    headers,
  });
});

attachmentRoutes.delete("/attachments/:attachmentId", requireUser, async (c) => {
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
