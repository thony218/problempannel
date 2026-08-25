import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../domain/types";
import { requireRole, requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";
import {
  getAnalyticsSummary,
  getEffectivenessMetrics,
  getErrorsByEmployee,
  getRecurringIssues,
} from "../services/analytics";
import { appConfigFromEnv } from "../domain/config";

const summaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locationId: z.coerce.number().int().min(1).optional(),
  departmentId: z.coerce.number().int().min(1).optional(),
  categoryId: z.coerce.number().int().min(1).optional(),
}).transform(({ from, to, dateFrom, dateTo, ...rest }) => ({
  ...rest,
  dateFrom: from ?? dateFrom,
  dateTo: to ?? dateTo,
}));

const recurringQuerySchema = z.object({
  locationId: z.coerce.number().int().min(1).optional(),
  departmentId: z.coerce.number().int().min(1).optional(),
  categoryId: z.coerce.number().int().min(1).optional(),
});

const effectivenessQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).transform(({ from, to, dateFrom, dateTo }) => ({
  dateFrom: from ?? dateFrom,
  dateTo: to ?? dateTo,
}));

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.get("/analytics/summary", requireUser, async (c) => {
  const queryResult = summaryQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const summary = await getAnalyticsSummary(c.env.DB, queryResult.data, appConfigFromEnv(c.env));
  return c.json(okBody(summary));
});

analyticsRoutes.get("/analytics/recurring", requireUser, async (c) => {
  const queryResult = recurringQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  // Seuils et fuseau lus via `appConfigFromEnv`, comme partout ailleurs :
  // une variable absente ou non numérique retombe sur une valeur sûre plutôt
  // que sur NaN.
  const groups = await getRecurringIssues(c.env.DB, queryResult.data, appConfigFromEnv(c.env));

  return c.json(okBody(groups));
});

analyticsRoutes.get("/analytics/effectiveness", requireUser, async (c) => {
  const queryResult = effectivenessQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const metrics = await getEffectivenessMetrics(c.env.DB, queryResult.data);
  return c.json(okBody(metrics));
});

analyticsRoutes.get(
  "/analytics/errors-by-employee",
  requireUser,
  requireRole("manager", "admin"),
  async (c) => {
    const queryResult = summaryQuerySchema.safeParse(c.req.query());
    if (!queryResult.success) {
      throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
    }

    const stats = await getErrorsByEmployee(c.env.DB, queryResult.data);
    return c.json(okBody(stats));
  }
);
