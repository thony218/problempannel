import { z } from "zod";

export const createCommentSchema = z.object({
  body: z.string().min(1, "Le commentaire ne peut être vide.").max(4000, "Le commentaire ne peut dépasser 4000 caractères."),
});

export const deleteCommentSchema = z.object({
  reason: z
    .string()
    .min(5, "Le motif de suppression doit comporter au moins 5 caractères.")
    .max(500, "Le motif ne peut dépasser 500 caractères."),
});

export const listCommentsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type DeleteCommentInput = z.infer<typeof deleteCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
