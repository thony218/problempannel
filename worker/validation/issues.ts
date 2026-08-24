import { z } from "zod";

export const impactInputSchema = z.strictObject({
  impactTypeId: z.number().int().min(1),
  details: z.string().max(1000).nullable().optional(),
});

export const priorityValues = ["normal", "important", "urgent"] as const;
export const issueStatusValues = ["new", "inProgress", "waiting", "resolved"] as const;
export const effectivenessStatusValues = ["pending", "effective", "ineffective"] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Miroir de CreateIssueRequest dans contracts/openapi.yaml.
 */
export const createIssueRequestSchema = z.strictObject({
  occurredOn: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)"),
  locationId: z.number().int().min(1),
  departmentId: z.number().int().min(1).nullable().optional(),
  categoryId: z.number().int().min(1),
  subcategoryId: z.number().int().min(1).nullable().optional(),
  description: z.string().min(10).max(5000),
  priority: z.enum(priorityValues),
  impacts: z.array(impactInputSchema).min(1).max(10),
});

export type CreateIssueInput = z.infer<typeof createIssueRequestSchema>;

/**
 * Validation des query parameters pour GET /issues.
 */
export const listIssuesQuerySchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().min(2).max(40).optional(),
  status: z
    .union([z.enum(issueStatusValues), z.array(z.enum(issueStatusValues))])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  priority: z
    .union([z.enum(priorityValues), z.array(z.enum(priorityValues))])
    .transform((val) => (Array.isArray(val) ? val : [val]))
    .optional(),
  locationId: z.coerce.number().int().min(1).optional(),
  departmentId: z.coerce.number().int().min(1).optional(),
  categoryId: z.coerce.number().int().min(1).optional(),
  ownerUserId: z.coerce.number().int().min(1).optional(),
  from: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)").optional(),
  to: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)").optional(),
  overdue: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => val === true || val === "true")
    .optional(),
  effectivenessStatus: z.enum(effectivenessStatusValues).optional(),
  effectivenessReviewDueBefore: z
    .string()
    .regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)")
    .optional(),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
