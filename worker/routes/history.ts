import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";

import { listIssueHistory } from "../services/history";

const listHistoryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const historyRoutes = new Hono<AppEnv>();

historyRoutes.get("/issues/:publicId/history", requireUser, async (c) => {
  const queryResult = listHistoryQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const result = await listIssueHistory(
    c.env.DB,
    c.req.param("publicId"),
    queryResult.data
  );

  if (!result) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(result));
});
