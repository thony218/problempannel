import type { components } from "../../src/shared/api-types.generated";
import type { IssueRow } from "../db/issues";
import type { UpdateIssueInput } from "../validation/issues";
import { AppError } from "./errors";

export type Role = components["schemas"]["Role"];

export interface ValidateIssueUpdatePermissionsParams {
  current: IssueRow;
  input: UpdateIssueInput;
  actorUserId: number;
  actorRole: Role;
}

const MANAGER_ADMIN_ONLY_FIELDS: (keyof UpdateIssueInput)[] = [
  "priority",
  "ownerUserId",
  "dueDate",
  "causeStatus",
  "causeSummary",
  "immediateSolution",
  "permanentCorrectionType",
  "permanentCorrectionSummary",
  "finalResult",
  "preventionLearning",
  "effectivenessStatus",
  "effectivenessReviewDate",
];

const CREATOR_CORRECTABLE_FIELDS: (keyof UpdateIssueInput)[] = [
  "occurredOn",
  "locationId",
  "departmentId",
  "categoryId",
  "subcategoryId",
  "description",
  "impacts",
];

/**
 * Valide les permissions d'accès et de modification par champ sur un dossier (QA-01, 01_produit/04_MATRICE_PERMISSIONS.md).
 * Lance AppError("FORBIDDEN", ...) si l'acteur tente de modifier un champ ou d'effectuer une action non autorisée pour son rôle.
 */
export function validateIssueUpdatePermissions(params: ValidateIssueUpdatePermissionsParams): void {
  const { current, input, actorUserId, actorRole } = params;

  if (actorRole === "manager" || actorRole === "admin") {
    return;
  }

  // Acteur rôle 'employee' :
  // 1. Vérifier les champs réservés aux managers/admins
  for (const field of MANAGER_ADMIN_ONLY_FIELDS) {
    if (field in input && input[field] !== undefined) {
      throw new AppError(
        "FORBIDDEN",
        `La modification du champ '${field}' est réservée aux gestionnaires et administrateurs.`
      );
    }
  }

  // 2. Vérifier les champs de déclaration / correction d'issue
  // "Corriger son issue : employee: créateur + new"
  const touchesCreatorField = CREATOR_CORRECTABLE_FIELDS.some(
    (field) => field in input && input[field] !== undefined
  );

  if (touchesCreatorField) {
    if (current.status !== "new") {
      throw new AppError(
        "FORBIDDEN",
        "Un employé ne peut modifier les détails d'un dossier que lorsqu'il est au statut 'new'."
      );
    }
    if (current.created_by_user_id !== actorUserId) {
      throw new AppError(
        "FORBIDDEN",
        "Seul le créateur du dossier est autorisé à en corriger les détails au statut 'new'."
      );
    }
  }

  // 3. Attente (waitingOn) : réservée au responsable désigné.
  // La vérification ne doit pas dépendre de la présence de `status` dans la
  // requête — sinon un employé non-responsable rejoue le statut courant
  // (transition no-op, donc validateStatusTransition sort immédiatement) et
  // détourne l'attente. Cf. 01_produit/03_MATRICE_TRANSITIONS.md
  // §Préconditions → waiting : « si acteur employee : il doit être owner ».
  if ("waitingOn" in input && input.waitingOn !== undefined) {
    if (current.owner_user_id !== actorUserId) {
      throw new AppError(
        "FORBIDDEN",
        "Seul le responsable désigné du dossier peut modifier l'attente en cours."
      );
    }
  }
}
