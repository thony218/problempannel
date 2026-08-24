import { z } from "zod";

export const impactInputSchema = z.strictObject({
  impactTypeId: z.number().int().min(1),
  details: z.string().max(1000).nullable().optional(),
});

export const priorityValues = ["normal", "important", "urgent"] as const;
export const issueStatusValues = ["new", "inProgress", "waiting", "resolved"] as const;
export const effectivenessStatusValues = ["pending", "effective", "ineffective"] as const;
export const causeStatusValues = ["toVerify", "known"] as const;
export const permanentCorrectionTypeValues = [
  "procedureUpdate",
  "newProcedure",
  "training",
  "systemConfiguration",
  "responsibilityChange",
  "additionalCheck",
  "supplierProcess",
  "noChangeRequired",
  "other",
] as const;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Miroir de WaitingOn dans contracts/openapi.yaml (union discriminée par `type`).
 */
const waitingOnUserSchema = z.strictObject({
  type: z.literal("user"),
  userId: z.number().int().min(1),
  label: z.string().max(120).nullable().optional(),
});
const waitingOnExternalSchema = z.strictObject({
  type: z.enum(["customer", "supplier", "other"]),
  userId: z.number().int().min(1).nullable().optional(),
  label: z.string().min(1).max(120),
});
export const waitingOnSchema = z.union([waitingOnUserSchema, waitingOnExternalSchema]);
export type WaitingOnInput = z.infer<typeof waitingOnSchema>;

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

/**
 * Miroir de UpdateIssueRequest dans contracts/openapi.yaml (minProperties:1,
 * additionalProperties:false). Accepte `status`/`waitingOn`/`reopenReason` tel
 * que défini au contrat ; aucune règle de transition (FLOW-02), de
 * précondition de résolution (FLOW-03) ni de permission par champ (FLOW-02
 * à 04 + QA-01) n'est appliquée ici — seule la cohérence structurelle déjà
 * imposée par les CHECK D1 (subcategory requise hors 'new', waitingOn
 * cohérent avec 'waiting') est validée en amont côté service pour éviter
 * un crash SQLITE_CONSTRAINT sur une requête par ailleurs bien formée.
 */
export const updateIssueRequestSchema = z
  .strictObject({
    occurredOn: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)").optional(),
    locationId: z.number().int().min(1).optional(),
    departmentId: z.number().int().min(1).nullable().optional(),
    categoryId: z.number().int().min(1).optional(),
    subcategoryId: z.number().int().min(1).nullable().optional(),
    description: z.string().min(10).max(5000).optional(),
    priority: z.enum(priorityValues).optional(),
    status: z.enum(issueStatusValues).optional(),
    ownerUserId: z.number().int().min(1).nullable().optional(),
    dueDate: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)").nullable().optional(),
    causeStatus: z.enum(causeStatusValues).nullable().optional(),
    causeSummary: z.string().max(5000).nullable().optional(),
    immediateSolution: z.string().max(5000).nullable().optional(),
    permanentCorrectionType: z.enum(permanentCorrectionTypeValues).nullable().optional(),
    permanentCorrectionSummary: z.string().max(5000).nullable().optional(),
    waitingOn: waitingOnSchema.nullable().optional(),
    finalResult: z.string().max(5000).nullable().optional(),
    preventionLearning: z.string().max(5000).nullable().optional(),
    effectivenessStatus: z.enum(effectivenessStatusValues).nullable().optional(),
    effectivenessReviewDate: z.string().regex(datePattern, "Format de date invalide (AAAA-MM-JJ attendu)").nullable().optional(),
    reopenReason: z.string().min(5).max(1000).nullable().optional(),
    impacts: z.array(impactInputSchema).min(1).max(10).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Au moins un champ est requis." });

export type UpdateIssueInput = z.infer<typeof updateIssueRequestSchema>;
