import type { Context } from "hono";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../domain/errors";

export function fieldsFromZodError(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    if (!(key in fields)) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

/**
 * Lit et valide le corps JSON d'une requête contre un schéma Zod. JSON
 * malformé -> 400 BAD_REQUEST ; schéma non respecté -> 422
 * VALIDATION_ERROR avec un champ par erreur (02_contrats/05_ERREURS.md).
 */
export async function parseJsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "Corps JSON invalide.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Validation échouée.", fieldsFromZodError(result.error));
  }
  return result.data;
}

/**
 * Lit et valide les query parameters d'une requête GET contre un schéma Zod.
 * Regroupe les paramètres simples et multi-valeurs.
 */
export function parseQueryParams<T>(c: Context, schema: ZodType<T>): T {
  const queries = c.req.queries();
  const raw: Record<string, unknown> = {};
  for (const [key, values] of Object.entries(queries)) {
    if (!values || values.length === 0) continue;
    if (values.length === 1) {
      raw[key] = values[0];
    } else {
      raw[key] = values;
    }
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Paramètres de requête invalides.", fieldsFromZodError(result.error));
  }
  return result.data;
}

