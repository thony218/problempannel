import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { decodeCursor, encodeCursor } from "../domain/cursor";
import { parsePublicId } from "../domain/publicId";
import { findActiveReferenceById, findActiveReferencesByIds, type ReferenceItem } from "../db/reference";
import { findActiveUserById } from "../db/users";
import {
  CAUSE_STATUS_API_TO_DB,
  CAUSE_STATUS_DB_TO_API,
  PERMANENT_CORRECTION_TYPE_API_TO_DB,
  PERMANENT_CORRECTION_TYPE_DB_TO_API,
  STATUS_API_TO_DB,
  STATUS_DB_TO_API,
  findIssueByPublicId,
  findIssueRowById,
  insertIssue,
  mapIssueRow,
  queryIssuesList,
  replaceIssueImpactsStatements,
  updateIssueRow,
  type ApiIssue,
  type IssueColumnUpdates,
  type IssueRow,
} from "../db/issues";
import { findImpactsByIssueId } from "../db/impacts";
import { countOpenBlockingCorrectiveActions, findCorrectiveActionsByIssueId } from "../db/corrective-actions";
import { insertHistoryEventStatement } from "../db/history";
import { issueETag } from "../domain/etag";
import { validateStatusTransition, type Role } from "../domain/transitions";
import { validateIssueUpdatePermissions } from "../domain/permissions";
import {
  computeDefaultReviewDate,
  validateResolutionPreconditions,
  type ApiEffectivenessStatus,
} from "../domain/resolution";
import type { CreateIssueInput, ListIssuesQuery, UpdateIssueInput } from "../validation/issues";




export type IssueDetail = components["schemas"]["IssueDetail"];

const NONE_EXTERNAL_CODE = "none_external";
const OTHER_CODE = "other";

/**
 * Règles communes à la création et à la modification des impacts d'un
 * dossier (01_CONTRAT_FONCTIONNEL_FINAL.md §1, 02_DICTIONNAIRE_CHAMPS.md
 * §Impacts) : chaque type doit exister/être actif, un même type ne peut
 * être sélectionné qu'une fois, "Autre" exige un détail, "Aucun impact
 * externe" est exclusif. Renvoie un message d'erreur unique ou undefined.
 */
function validateImpactsAgainstTypes(
  impacts: { impactTypeId: number; details?: string | null }[],
  impactTypes: Map<number, ReferenceItem>
): string | undefined {
  const impactTypeIds = impacts.map((impact) => impact.impactTypeId);
  const hasDuplicateImpactType = impactTypeIds.some((id, index) => impactTypeIds.indexOf(id) !== index);
  if (hasDuplicateImpactType) {
    return "Un même type d'impact ne peut être sélectionné qu'une fois.";
  }
  for (const impact of impacts) {
    const impactType = impactTypes.get(impact.impactTypeId);
    if (!impactType) {
      return "Un type d'impact est introuvable ou inactif.";
    }
    if (impactType.code === OTHER_CODE && !impact.details?.trim()) {
      return 'Un détail est requis lorsque le type d\'impact est "Autre".';
    }
  }
  if (
    impacts.length > 1 &&
    impacts.some((impact) => impactTypes.get(impact.impactTypeId)?.code === NONE_EXTERNAL_CODE)
  ) {
    return '"Aucun impact externe" ne peut pas être combiné à d\'autres impacts.';
  }
  return undefined;
}

/**
 * Règles métier de 01_CONTRAT_FONCTIONNEL_FINAL.md (§1) et
 * 02_DICTIONNAIRE_CHAMPS.md (§Impacts), vérifiées côté serveur (G-010) :
 * les références doivent exister et être actives, la sous-catégorie (si
 * fournie) doit appartenir à la catégorie choisie, "Aucun impact externe"
 * est exclusif, et "Autre" exige un détail. Toutes les erreurs sont
 * accumulées pour renvoyer un seul 422 avec tous les champs en cause,
 * plutôt que de forcer le client à corriger un champ à la fois.
 */
export async function createIssue(
  db: D1Database,
  createdByUserId: number,
  input: CreateIssueInput
): Promise<ApiIssue> {
  const fields: Record<string, string> = {};

  const [location, category, department, subcategory, impactTypes] = await Promise.all([
    findActiveReferenceById(db, "locations", input.locationId),
    findActiveReferenceById(db, "categories", input.categoryId),
    input.departmentId != null
      ? findActiveReferenceById(db, "departments", input.departmentId)
      : Promise.resolve(undefined),
    input.subcategoryId != null
      ? findActiveReferenceById(db, "subcategories", input.subcategoryId)
      : Promise.resolve(undefined),
    findActiveReferencesByIds(
      db,
      "impact_types",
      input.impacts.map((impact) => impact.impactTypeId)
    ),
  ]);

  if (!location) {
    fields.locationId = "Succursale introuvable ou inactive.";
  }
  if (!category) {
    fields.categoryId = "Catégorie introuvable ou inactive.";
  }
  if (input.departmentId != null && !department) {
    fields.departmentId = "Département introuvable ou inactif.";
  }
  if (input.subcategoryId != null) {
    if (!subcategory) {
      fields.subcategoryId = "Sous-catégorie introuvable ou inactive.";
    } else if (category && subcategory.parentId !== category.id) {
      fields.subcategoryId = "La sous-catégorie ne correspond pas à la catégorie choisie.";
    }
  }

  const impactsError = validateImpactsAgainstTypes(input.impacts, impactTypes);
  if (impactsError) {
    fields.impacts = impactsError;
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("VALIDATION_ERROR", "Validation échouée.", fields);
  }

  return insertIssue(db, {
    occurredOn: input.occurredOn,
    createdByUserId,
    locationId: input.locationId,
    departmentId: input.departmentId ?? null,
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId ?? null,
    description: input.description,
    priority: input.priority,
    impacts: input.impacts.map((impact) => ({
      impactTypeId: impact.impactTypeId,
      details: impact.details ?? null,
    })),
  });
}

export interface ListIssuesResponseData {
  items: ApiIssue[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Service de listage des dossiers : décode le curseur opaque, appelle la requête
 * DB filtrée et encode le curseur de la page suivante si disponible.
 */
export async function listIssues(
  db: D1Database,
  query: ListIssuesQuery
): Promise<ListIssuesResponseData> {
  let cursorId: number | null = null;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (!decoded) {
      throw new AppError("VALIDATION_ERROR", "Curseur invalide.", {
        cursor: "Curseur de pagination invalide ou expiré.",
      });
    }
    cursorId = decoded.id;
  }

  const result = await queryIssuesList(db, {
    cursorId,
    limit: query.limit,
    q: query.q,
    status: query.status,
    priority: query.priority,
    locationId: query.locationId,
    departmentId: query.departmentId,
    categoryId: query.categoryId,
    ownerUserId: query.ownerUserId,
    from: query.from,
    to: query.to,
    overdue: query.overdue,
    effectivenessStatus: query.effectivenessStatus,
    effectivenessReviewDueBefore: query.effectivenessReviewDueBefore,
  });

  const items = result.rows.map(mapIssueRow);
  const nextCursor =
    result.hasMore && result.rows.length > 0
      ? encodeCursor({ id: result.rows[result.rows.length - 1].id })
      : null;

  return {
    items,
    nextCursor,
    hasMore: result.hasMore,
  };
}

/**
 * `null` couvre à la fois un format `publicId` invalide et un id inconnu
 * (`findIssueByPublicId` renvoie déjà `null` dans les deux cas) : le
 * routeur répond 404 sans distinguer les deux, cf. `V4-ID-01`.
 */
export async function getIssueDetail(db: D1Database, publicId: string): Promise<IssueDetail | null> {
  const id = parsePublicId(publicId);
  if (id === null) {
    return null;
  }

  const [issue, impacts, correctiveActions] = await Promise.all([
    findIssueByPublicId(db, publicId),
    findImpactsByIssueId(db, id),
    findCorrectiveActionsByIssueId(db, id),
  ]);

  if (!issue) {
    return null;
  }

  return { issue, impacts, correctiveActions };
}

/**
 * PATCH /issues/{publicId} — mécanique de concurrence optimiste (FLOW-01).
 *
 * Portée volontairement limitée : applique les champs fournis et garde la
 * ligne cohérente avec les CHECK D1 (subcategory requise hors 'new',
 * waitingOn cohérent avec 'waiting', resolvedAt/By reflète le statut). Ne
 * met en œuvre ni la matrice de transitions (`FLOW-02`,
 * `01_produit/03_MATRICE_TRANSITIONS.md`), ni les préconditions de
 * résolution (`FLOW-03`), ni la règle de réouverture (`FLOW-04`), ni la
 * permission par champ (`01_produit/04_MATRICE_PERMISSIONS.md`, couverte
 * par `QA-01`) — tout statut est acceptable pour l'instant tant qu'il
 * respecte les contraintes structurelles de la table, et `requireUser`
 * (n'importe quel utilisateur actif) est la seule porte d'entrée.
 *
 * `null` = publicId invalide ou dossier introuvable (404 côté route,
 * même contrat que getIssueDetail/findIssueByPublicId, cf. V4-ID-01).
 * Lance `AppError("CONFLICT")` (409) si `ifMatch` ne correspond pas à
 * l'ETag courant, ou si une écriture concurrente a fait avancer
 * `row_version` entre cette lecture et l'UPDATE (revérifié au niveau SQL
 * via `WHERE row_version = ?`, cf. `updateIssueRow`).
 */
export async function updateIssue(
  db: D1Database,
  publicId: string,
  ifMatch: string,
  actorUserId: number,
  actorRole: Role,
  input: UpdateIssueInput
): Promise<IssueDetail | null> {
  const id = parsePublicId(publicId);
  if (id === null) {
    return null;
  }

  const current: IssueRow | null = await findIssueRowById(db, id);
  if (!current) {
    return null;
  }

  if (issueETag(id, current.row_version) !== ifMatch) {
    throw new AppError("CONFLICT", "Le dossier a été modifié entretemps.");
  }

  validateIssueUpdatePermissions({ current, input, actorUserId, actorRole });

  const fields: Record<string, string> = {};

  const columns: IssueColumnUpdates = {};

  const [location, category, department, subcategory, owner, waitingUser, impactTypes] = await Promise.all([
    input.locationId != null ? findActiveReferenceById(db, "locations", input.locationId) : Promise.resolve(undefined),
    input.categoryId != null ? findActiveReferenceById(db, "categories", input.categoryId) : Promise.resolve(undefined),
    input.departmentId != null
      ? findActiveReferenceById(db, "departments", input.departmentId)
      : Promise.resolve(undefined),
    input.subcategoryId != null
      ? findActiveReferenceById(db, "subcategories", input.subcategoryId)
      : Promise.resolve(undefined),
    input.ownerUserId != null ? findActiveUserById(db, input.ownerUserId) : Promise.resolve(undefined),
    input.waitingOn?.type === "user" ? findActiveUserById(db, input.waitingOn.userId) : Promise.resolve(undefined),
    input.impacts
      ? findActiveReferencesByIds(
          db,
          "impact_types",
          input.impacts.map((impact) => impact.impactTypeId)
        )
      : Promise.resolve(undefined),
  ]);

  if ("occurredOn" in input) columns.occurred_on = input.occurredOn;
  if ("locationId" in input) {
    if (!location) fields.locationId = "Succursale introuvable ou inactive.";
    else columns.location_id = input.locationId;
  }

  const categoryTouched = "categoryId" in input;
  if (categoryTouched) {
    if (!category) fields.categoryId = "Catégorie introuvable ou inactive.";
    else columns.category_id = input.categoryId;
  }

  const subcategoryTouched = "subcategoryId" in input;
  if (subcategoryTouched) {
    if (input.subcategoryId != null && !subcategory) fields.subcategoryId = "Sous-catégorie introuvable ou inactive.";
    else columns.subcategory_id = input.subcategoryId ?? null;
  }

  const nextCategoryId = categoryTouched ? (category?.id ?? null) : current.category_id;
  const nextSubcategoryId = subcategoryTouched ? (input.subcategoryId ?? null) : current.subcategory_id;

  if (!fields.categoryId && !fields.subcategoryId && (categoryTouched || subcategoryTouched) && nextSubcategoryId != null) {
    const effectiveSubcategory = subcategoryTouched
      ? (subcategory ?? null)
      : await findActiveReferenceById(db, "subcategories", nextSubcategoryId);
    if (!effectiveSubcategory) {
      fields.subcategoryId = "Sous-catégorie introuvable ou inactive.";
    } else if (nextCategoryId != null && effectiveSubcategory.parentId !== nextCategoryId) {
      fields.subcategoryId = "La sous-catégorie ne correspond pas à la catégorie choisie.";
    }
  }

  if ("departmentId" in input) {
    if (input.departmentId != null && !department) fields.departmentId = "Département introuvable ou inactif.";
    else columns.department_id = input.departmentId ?? null;
  }

  if ("description" in input) columns.description = input.description;
  if ("priority" in input) columns.priority = input.priority;

  const statusTouched = "status" in input;
  const nextStatusDb = statusTouched ? STATUS_API_TO_DB[input.status!] : current.status;
  if (statusTouched && input.status) {
    const fromStatus = STATUS_DB_TO_API[current.status];
    const toStatus = input.status;
    const isOwner = current.owner_user_id === actorUserId;
    validateStatusTransition({ fromStatus, toStatus, actorRole, isOwner });
    columns.status = nextStatusDb;
  }

  if (nextStatusDb !== "new" && nextSubcategoryId == null && !fields.subcategoryId) {
    fields.subcategoryId = "Sous-catégorie requise pour sortir du statut 'new'.";
  }


  if ("ownerUserId" in input) {
    if (input.ownerUserId != null && !owner) fields.ownerUserId = "Utilisateur introuvable ou inactif.";
    else columns.owner_user_id = input.ownerUserId ?? null;
  }

  if ("dueDate" in input) columns.due_date = input.dueDate ?? null;

  if ("causeStatus" in input) {
    columns.cause_status = input.causeStatus ? CAUSE_STATUS_API_TO_DB[input.causeStatus] : null;
  }
  if ("causeSummary" in input) columns.cause_summary = input.causeSummary ?? null;
  if ("immediateSolution" in input) columns.immediate_solution = input.immediateSolution ?? null;
  if ("permanentCorrectionType" in input) {
    columns.permanent_correction_type = input.permanentCorrectionType
      ? PERMANENT_CORRECTION_TYPE_API_TO_DB[input.permanentCorrectionType]
      : null;
  }
  if ("permanentCorrectionSummary" in input) columns.permanent_correction_summary = input.permanentCorrectionSummary ?? null;
  if ("finalResult" in input) columns.final_result = input.finalResult ?? null;
  if ("preventionLearning" in input) columns.prevention_learning = input.preventionLearning ?? null;
  if ("effectivenessStatus" in input) columns.effectiveness_status = input.effectivenessStatus ?? null;
  if ("effectivenessReviewDate" in input) columns.effectiveness_review_date = input.effectivenessReviewDate ?? null;

  if (nextStatusDb === "resolved") {
    const effectiveCauseStatus =
      input.causeStatus !== undefined
        ? input.causeStatus
        : current.cause_status
          ? CAUSE_STATUS_DB_TO_API[current.cause_status]
          : null;
    const effectiveCauseSummary =
      input.causeSummary !== undefined ? input.causeSummary : current.cause_summary;
    const effectivePermanentCorrectionType =
      input.permanentCorrectionType !== undefined
        ? input.permanentCorrectionType
        : current.permanent_correction_type
          ? PERMANENT_CORRECTION_TYPE_DB_TO_API[current.permanent_correction_type]
          : null;
    const effectivePermanentCorrectionSummary =
      input.permanentCorrectionSummary !== undefined
        ? input.permanentCorrectionSummary
        : current.permanent_correction_summary;
    const effectiveFinalResult =
      input.finalResult !== undefined ? input.finalResult : current.final_result;
    const effectivePreventionLearning =
      input.preventionLearning !== undefined ? input.preventionLearning : current.prevention_learning;
    const effectiveEffectivenessStatus =
      input.effectivenessStatus !== undefined
        ? input.effectivenessStatus
        : (current.effectiveness_status as ApiEffectivenessStatus | null);

    const openBlockingActionsCount = await countOpenBlockingCorrectiveActions(db, id);

    const resolutionErrors = validateResolutionPreconditions({
      causeStatus: effectiveCauseStatus,
      causeSummary: effectiveCauseSummary,
      permanentCorrectionType: effectivePermanentCorrectionType,
      permanentCorrectionSummary: effectivePermanentCorrectionSummary,
      finalResult: effectiveFinalResult,
      preventionLearning: effectivePreventionLearning,
      effectivenessStatus: effectiveEffectivenessStatus,
      openBlockingActionsCount,
    });
    Object.assign(fields, resolutionErrors);

    // S12 / D-29 : si effectivenessStatus === 'pending' et date absente, +30 jours par défaut
    if (effectiveEffectivenessStatus === "pending") {
      const reviewDate =
        input.effectivenessReviewDate !== undefined
          ? input.effectivenessReviewDate
          : current.effectiveness_review_date;
      if (!reviewDate) {
        columns.effectiveness_review_date = computeDefaultReviewDate();
      }
    }
  }

  const waitingTouched = "waitingOn" in input;

  if (waitingTouched && input.waitingOn?.type === "user" && !waitingUser) {
    fields.waitingOn = "Utilisateur introuvable ou inactif.";
  }
  if (waitingTouched && !fields.waitingOn) {
    if (input.waitingOn == null) {
      columns.waiting_on_type = null;
      columns.waiting_on_user_id = null;
      columns.waiting_on_label = null;
    } else if (input.waitingOn.type === "user") {
      columns.waiting_on_type = "user";
      columns.waiting_on_user_id = input.waitingOn.userId;
      columns.waiting_on_label = input.waitingOn.label ?? null;
    } else {
      columns.waiting_on_type = input.waitingOn.type;
      columns.waiting_on_user_id = null;
      columns.waiting_on_label = input.waitingOn.label;
    }
  }

  // Cohérence structurelle avec le CHECK D1 : status='waiting' <=> waitingOn défini.
  if (!fields.waitingOn) {
    if (nextStatusDb === "waiting") {
      const hasWaiting = waitingTouched ? input.waitingOn != null : current.waiting_on_type != null;
      if (!hasWaiting) {
        fields.waitingOn = "Une attente (waitingOn) est requise en statut 'waiting'.";
      }
    } else if (waitingTouched && input.waitingOn != null) {
      fields.waitingOn = "waitingOn n'est valide qu'en statut 'waiting'.";
    } else if (!waitingTouched && current.waiting_on_type != null) {
      // Le statut quitte 'waiting' sans que waitingOn ait été fourni : purge auto des 3 colonnes.
      columns.waiting_on_type = null;
      columns.waiting_on_user_id = null;
      columns.waiting_on_label = null;
    }
  }

  const isReopening = current.status === "resolved" && nextStatusDb === "in_progress";
  if (isReopening) {
    if (!input.reopenReason || input.reopenReason.trim().length < 5) {
      fields.reopenReason = "La raison de réouverture est requise (au moins 5 caractères).";
    }
  } else if ("reopenReason" in input && input.reopenReason != null) {
    fields.reopenReason = "La raison de réouverture n'est valide que lors de la réouverture d'un dossier résolu.";
  }

  if (input.impacts) {
    const impactsError = validateImpactsAgainstTypes(input.impacts, impactTypes!);
    if (impactsError) fields.impacts = impactsError;
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError("VALIDATION_ERROR", "Validation échouée.", fields);
  }

  let touchResolvedAtNow = false;
  let clearResolvedAt = false;
  if (statusTouched && nextStatusDb !== current.status) {
    if (nextStatusDb === "resolved") {
      touchResolvedAtNow = true;
      columns.resolved_by_user_id = actorUserId;
    } else if (current.status === "resolved") {
      clearResolvedAt = true;
      columns.resolved_by_user_id = null;
    }
  }

  const updatedRow = await updateIssueRow(db, id, current.row_version, columns, {
    touchResolvedAtNow,
    clearResolvedAt,
  });
  if (!updatedRow) {
    throw new AppError("CONFLICT", "Le dossier a été modifié entretemps.");
  }

  const followUpStatements = input.impacts
    ? replaceIssueImpactsStatements(
        db,
        id,
        input.impacts.map((impact) => ({ impactTypeId: impact.impactTypeId, details: impact.details ?? null }))
      )
    : [];

  const eventType = isReopening ? "issue_reopened" : "issue_updated";
  const historyPayload: Record<string, unknown> = { fields: Object.keys(input).sort() };
  if (isReopening && input.reopenReason) {
    historyPayload.reopenReason = input.reopenReason;
  }

  followUpStatements.push(
    insertHistoryEventStatement(db, id, {
      actorUserId,
      eventType,
      payload: historyPayload,
    })
  );
  await db.batch(followUpStatements);

  return getIssueDetail(db, publicId);
}


