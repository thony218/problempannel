import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";
import { createLink, listLinks, removeLink } from "../services/links";

const createLinkSchema = z.object({
  relatedPublicId: z.string().regex(/^INC-\d{6}$/, "Format de numéro de dossier invalide (attendu: INC-XXXXXX)."),
});

export const linkRoutes = new Hono<AppEnv>();

linkRoutes.get("/issues/:publicId/links", requireUser, async (c) => {
  const items = await listLinks(c.env.DB, c.req.param("publicId"));
  if (!items) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  return c.json(okBody(items));
});

linkRoutes.post("/issues/:publicId/links", requireUser, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createLinkSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const user = c.get("user");
  const link = await createLink(
    c.env.DB,
    c.req.param("publicId"),
    parsed.data.relatedPublicId,
    user.id,
    user.role
  );

  if (!link) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(link), 201);
});

linkRoutes.delete("/issues/:publicId/links/:relatedPublicId", requireUser, async (c) => {
  const user = c.get("user");
  const removed = await removeLink(
    c.env.DB,
    c.req.param("publicId"),
    c.req.param("relatedPublicId"),
    user.id,
    user.role
  );

  if (!removed) {
    throw new AppError("NOT_FOUND", "Liaison ou dossier introuvable.");
  }

  return c.body(null, 204);
});
