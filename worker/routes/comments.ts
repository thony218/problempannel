import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";

import {
  createCommentSchema,
  deleteCommentSchema,
  listCommentsQuerySchema,
} from "../validation/comments";
import { createComment, deleteComment, listComments } from "../services/comments";

export const commentRoutes = new Hono<AppEnv>();

commentRoutes.get("/issues/:publicId/comments", requireUser, async (c) => {
  const queryResult = listCommentsQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const result = await listComments(c.env.DB, c.req.param("publicId"), queryResult.data);
  if (!result) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(result));
});

commentRoutes.post("/issues/:publicId/comments", requireUser, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const user = c.get("user");
  const comment = await createComment(c.env.DB, c.req.param("publicId"), parsed.data, user.id);
  if (!comment) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(comment), 201);
});

commentRoutes.delete("/comments/:commentId", requireUser, async (c) => {
  const commentId = Number(c.req.param("commentId"));
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new AppError("NOT_FOUND", "Commentaire introuvable.");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = deleteCommentSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const user = c.get("user");
  const deleted = await deleteComment(c.env.DB, commentId, parsed.data, user.id, user.role);
  if (!deleted) {
    throw new AppError("NOT_FOUND", "Commentaire introuvable.");
  }

  return c.body(null, 204);
});
