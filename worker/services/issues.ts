import { AppError } from "../domain/errors";
import { decodeCursor, encodeCursor } from "../domain/cursor";
import { findActiveReferenceById, findActiveReferencesByIds } from "../db/reference";
import { insertIssue, mapIssueRow, queryIssuesList, type ApiIssue } from "../db/issues";
import type { CreateIssueInput, ListIssuesQuery } from "../validation/issues";


const NONE_EXTERNAL_CODE = "none_external";
const OTHER_CODE = "other";

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

  const impactTypeIds = input.impacts.map((impact) => impact.impactTypeId);
  const hasDuplicateImpactType = impactTypeIds.some((id, index) => impactTypeIds.indexOf(id) !== index);
  if (hasDuplicateImpactType) {
    fields.impacts = "Un même type d'impact ne peut être sélectionné qu'une fois.";
  } else {
    for (const impact of input.impacts) {
      const impactType = impactTypes.get(impact.impactTypeId);
      if (!impactType) {
        fields.impacts = "Un type d'impact est introuvable ou inactif.";
        break;
      }
      if (impactType.code === OTHER_CODE && !impact.details?.trim()) {
        fields.impacts = 'Un détail est requis lorsque le type d\'impact est "Autre".';
        break;
      }
    }
    if (
      !fields.impacts &&
      input.impacts.length > 1 &&
      input.impacts.some((impact) => impactTypes.get(impact.impactTypeId)?.code === NONE_EXTERNAL_CODE)
    ) {
      fields.impacts = '"Aucun impact externe" ne peut pas être combiné à d\'autres impacts.';
    }
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

