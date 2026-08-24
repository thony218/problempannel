import { z } from "zod";

export const impactInputSchema = z.strictObject({
  impactTypeId: z.number().int().min(1),
  details: z.string().max(1000).nullable().optional(),
});

export const priorityValues = ["normal", "important", "urgent"] as const;

/**
 * Miroir de CreateIssueRequest dans contracts/openapi.yaml. Le contrat
 * OpenAPI reste l'autorité (G-002) ; ce schéma Zod est la validation
 * d'exécution correspondante (le lint OpenAPI ne valide que la forme du
 * contrat, jamais les requêtes réelles).
 */
export const createIssueRequestSchema = z.strictObject({
  occurredOn: z.iso.date(),
  locationId: z.number().int().min(1),
  departmentId: z.number().int().min(1).nullable().optional(),
  categoryId: z.number().int().min(1),
  subcategoryId: z.number().int().min(1).nullable().optional(),
  description: z.string().min(10).max(5000),
  priority: z.enum(priorityValues),
  impacts: z.array(impactInputSchema).min(1).max(10),
});

export type CreateIssueInput = z.infer<typeof createIssueRequestSchema>;
