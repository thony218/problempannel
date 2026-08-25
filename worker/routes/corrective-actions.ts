import { Hono } from "hono";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";

import {
  createCorrectiveActionSchema,
  updateCorrectiveActionSchema,
} from "../validation/corrective-actions";
import {
  createCorrectiveAction,
  getCorrectiveAction,
  listCorrectiveActions,
  updateCorrectiveAction,
} from "../services/corrective-actions";

export const correctiveActionRoutes = new Hono<AppEnv>();

correctiveActionRoutes.get("/issues/:publicId/corrective-actions", requireUser, async (c) => {
  const items = await listCorrectiveActions(c.env.DB, c.req.param("publicId"));
  if (!items) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }
  return c.json(okBody(items));
});

correctiveActionRoutes.post("/issues/:publicId/corrective-actions", requireUser, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createCorrectiveActionSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const user = c.get("user");
  const created = await createCorrectiveAction(
    c.env.DB,
    c.req.param("publicId"),
    parsed.data,
    user.id,
    user.role
  );

  if (!created) {
    throw new AppError("NOT_FOUND", "Dossier introuvable.");
  }

  return c.json(okBody(created), 201);
});

correctiveActionRoutes.get("/corrective-actions/:actionId", requireUser, async (c) => {
  const actionId = Number(c.req.param("actionId"));
  if (!Number.isInteger(actionId) || actionId <= 0) {
    throw new AppError("NOT_FOUND", "Action corrective introuvable.");
  }

  const action = await getCorrectiveAction(c.env.DB, actionId);
  if (!action) {
    throw new AppError("NOT_FOUND", "Action corrective introuvable.");
  }

  return c.json(okBody(action));
});

correctiveActionRoutes.patch("/corrective-actions/:actionId", requireUser, async (c) => {
  const actionId = Number(c.req.param("actionId"));
  if (!Number.isInteger(actionId) || actionId <= 0) {
    throw new AppError("NOT_FOUND", "Action corrective introuvable.");
  }

  const body = await c.req.json().catch(() => null);
  const parsed = updateCorrectiveActionSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".");
      if (path) fields[path] = issue.message;
    }
    throw new AppError("VALIDATION_ERROR", "Données invalides.", fields);
  }

  const user = c.get("user");
  const updated = await updateCorrectiveAction(
    c.env.DB,
    actionId,
    parsed.data,
    user.id,
    user.role
  );

  if (!updated) {
    throw new AppError("NOT_FOUND", "Action corrective introuvable.");
  }

  return c.json(okBody(updated));
});
