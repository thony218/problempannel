import { z } from "zod";

export const createCorrectiveActionSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères.").max(200, "Le titre ne peut dépasser 200 caractères."),
  description: z.string().max(3000, "La description ne peut dépasser 3000 caractères.").nullable().optional(),
  ownerUserId: z.number().int().min(1, "Responsable invalide."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'échéance invalide (format attendu: YYYY-MM-DD)."),
  status: z.enum(["todo", "inProgress", "waiting", "done"]),
  blocksIssueClosure: z.boolean(),
});

export const updateCorrectiveActionSchema = z.object({
  title: z.string().min(3, "Le titre doit comporter au moins 3 caractères.").max(200).optional(),
  description: z.string().max(3000).nullable().optional(),
  ownerUserId: z.number().int().min(1).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["todo", "inProgress", "waiting", "done"]).optional(),
  blocksIssueClosure: z.boolean().optional(),
  result: z.string().max(3000).nullable().optional(),
  effectivenessStatus: z.enum(["pending", "effective", "ineffective"]).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "Au moins un champ doit être fourni pour la mise à jour.",
});

export type CreateCorrectiveActionInput = z.infer<typeof createCorrectiveActionSchema>;
export type UpdateCorrectiveActionInput = z.infer<typeof updateCorrectiveActionSchema>;
