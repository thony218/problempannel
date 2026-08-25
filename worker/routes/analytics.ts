import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../domain/types";
import { requireUser } from "../auth/middleware";
import { AppError, okBody } from "../domain/errors";
import {
  getAnalyticsSummary,
  getEffectivenessMetrics,
  getRecurringIssues,
} from "../services/analytics";

const summaryQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  locationId: z.coerce.number().int().min(1).optional(),
  departmentId: z.coerce.number().int().min(1).optional(),
  categoryId: z.coerce.number().int().min(1).optional(),
});

const recurringQuerySchema = z.object({
  locationId: z.coerce.number().int().min(1).optional(),
  departmentId: z.coerce.number().int().min(1).optional(),
  categoryId: z.coerce.number().int().min(1).optional(),
});

const effectivenessQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const analyticsRoutes = new Hono<AppEnv>();

analyticsRoutes.get("/analytics/summary", requireUser, async (c) => {
  const queryResult = summaryQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const summary = await getAnalyticsSummary(c.env.DB, queryResult.data);
  return c.json(okBody(summary));
});

analyticsRoutes.get("/analytics/recurring", requireUser, async (c) => {
  const queryResult = recurringQuerySchema.safeParse(c.req.query());
  if (!queryResult.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.");
  }

  const windowDays = Number(c.env.RECURRING_WINDOW_DAYS || 90);
  const minCount = Number(c.env.RECURRING_MIN_COUNT || 3);

  const groups = await getRecurringIssues(c.env.DB, queryResult.data, {
    windowDays,
    minCount,
  });

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
