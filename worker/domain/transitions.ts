import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "./errors";
import { statusLabel } from "./labels";

export type ApiIssueStatus = components["schemas"]["IssueStatus"];
export type Role = components["schemas"]["Role"];

export interface ValidateStatusTransitionParams {
  fromStatus: ApiIssueStatus;
  toStatus: ApiIssueStatus;
  actorRole: Role;
  isOwner: boolean;
}

/**
 * Matrice exhaustive des transitions V3 (01_produit/03_MATRICE_TRANSITIONS.md, 16 cellules).
 *
 * Règles :
 * - Si fromStatus === toStatus : no-op (autorisé).
 * - Transitions interdites dans le graphe d'états pour tous les rôles -> INVALID_STATUS_TRANSITION (422) :
 *   * inProgress -> new
 *   * waiting -> new
 *   * resolved -> new
 *   * resolved -> waiting
 * - Transitions valides dans le graphe mais nécessitant des privilèges :
 *   * new -> inProgress/waiting/resolved : manager ou admin (employee -> 403 FORBIDDEN)
 *   * inProgress -> resolved : manager ou admin (employee -> 403 FORBIDDEN)
 *   * waiting -> resolved : manager ou admin (employee -> 403 FORBIDDEN)
 *   * resolved -> inProgress : manager ou admin (employee -> 403 FORBIDDEN)
 *   * inProgress <-> waiting : manager ou admin, OU employee si isOwner (autre employee -> 403 FORBIDDEN, S08)
 */
export function validateStatusTransition(params: ValidateStatusTransitionParams): void {
  const { fromStatus, toStatus, actorRole, isOwner } = params;

  if (fromStatus === toStatus) {
    return;
  }

  // 1. Transitions structurellement interdites dans le cycle de vie pour tout rôle
  if (toStatus === "new") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Impossible de revenir au statut ${statusLabel("new")} depuis le statut ${statusLabel(fromStatus)}.`
    );
  }

  if (fromStatus === "resolved" && toStatus === "waiting") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      `Impossible de passer directement du statut ${statusLabel("resolved")} au statut ${statusLabel("waiting")}.`
    );
  }

  // 2. Transitions réservées aux managers et admins uniquement
  if (
    fromStatus === "new" ||
    toStatus === "resolved" ||
    (fromStatus === "resolved" && toStatus === "inProgress")
  ) {
    if (actorRole !== "manager" && actorRole !== "admin") {
      throw new AppError(
        "FORBIDDEN",
        `Seul un gestionnaire ou un administrateur peut effectuer la transition de ${statusLabel(fromStatus)} vers ${statusLabel(toStatus)}.`
      );
    }
    return;
  }

  // 3. Transitions inProgress <-> waiting (autorisées aux managers/admins et aux employés s'ils sont owner)
  if (
    (fromStatus === "inProgress" && toStatus === "waiting") ||
    (fromStatus === "waiting" && toStatus === "inProgress")
  ) {
    if (actorRole === "manager" || actorRole === "admin") {
      return;
    }
    if (actorRole === "employee" && isOwner) {
      return;
    }
    throw new AppError(
      "FORBIDDEN",
      "Un employé doit être le responsable désigné du dossier pour modifier cette attente."
    );
  }

  // Filet de sécurité au cas où un état non géré apparaît
  throw new AppError(
    "INVALID_STATUS_TRANSITION",
    `Transition non autorisée de ${statusLabel(fromStatus)} vers ${statusLabel(toStatus)}.`
  );
}
