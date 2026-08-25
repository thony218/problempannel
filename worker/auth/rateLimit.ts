import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../domain/types";
import { AppError } from "../domain/errors";

/**
 * Limitation de débit par utilisateur interne (02_contrats/04_SECURITE_AUTH.md).
 *
 * - écritures : 120/minute/utilisateur (`WRITE_RATE_LIMIT`);
 * - téléversements : 20/minute/utilisateur (`UPLOAD_RATE_LIMIT`).
 *
 * La clé est **l'identifiant interne**, jamais l'IP ni le courriel : plusieurs
 * employés d'une même succursale partagent une sortie réseau, et le courriel
 * est une donnée personnelle qui n'a pas à circuler dans une clé de quota.
 *
 * À monter **après** `requireUser`, qui seul renseigne `c.get("user")`.
 */
export type RateLimitKind = "write" | "upload";

export function rateLimit(kind: RateLimitKind): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = kind === "upload" ? c.env.UPLOAD_RATE_LIMIT : c.env.WRITE_RATE_LIMIT;

    // Un binding absent ne doit pas transformer une écriture légitime en 500 :
    // le quota est une protection, pas une condition de correction. L'absence
    // est signalée dans les logs par la ligne de requête (aucun `limited`).
    if (!limiter) {
      await next();
      return;
    }

    const user = c.get("user");
    const { success } = await limiter.limit({ key: `${kind}:${user.id}` });

    if (!success) {
      throw new AppError(
        "RATE_LIMITED",
        kind === "upload"
          ? "Trop de téléversements en peu de temps. Réessayez dans une minute."
          : "Trop de modifications en peu de temps. Réessayez dans une minute."
      );
    }

    await next();
  };
}
