import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../domain/types";
import type { UserRole } from "../db/users";
import { AppError } from "../domain/errors";
import { findUserByEmail } from "../db/users";
import { resolveIdentityEmail } from "./identity";

/**
 * Résout l'identité, charge l'utilisateur interne et vérifie qu'il est
 * actif. Attache l'utilisateur dans le contexte (`c.get("user")`) pour les
 * middlewares/handlers suivants. Cf. 02_contrats/04_SECURITE_AUTH.md :
 * identité valide -> utilisateur existant -> actif -> rôle -> permission.
 */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const email = await resolveIdentityEmail(c);
  const user = await findUserByEmail(c.env.DB, email);
  if (!user) {
    throw new AppError("UNAUTHORIZED", "Aucun utilisateur interne pour cette identité.");
  }
  if (!user.active) {
    throw new AppError("USER_INACTIVE", "Compte désactivé.");
  }
  c.set("user", user);
  await next();
};

/**
 * À utiliser après `requireUser`. Refuse si le rôle de l'utilisateur
 * courant n'est pas dans la liste autorisée (G-006 : la permission se
 * vérifie côté serveur, jamais seulement en masquant un bouton).
 */
export function requireRole(...roles: UserRole[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      throw new AppError("FORBIDDEN", "Rôle insuffisant pour cette action.");
    }
    await next();
  };
}
