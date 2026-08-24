import type { components } from "../../src/shared/api-types.generated";
import { parsePublicId, toPublicId } from "../domain/publicId";

export type ApiIssue = components["schemas"]["Issue"];
export type ApiIssueStatus = components["schemas"]["IssueStatus"];
export type ApiCauseStatus = components["schemas"]["CauseStatus"];
export type ApiPermanentCorrectionType = components["schemas"]["PermanentCorrectionType"];
export type ApiWaitingOn = components["schemas"]["WaitingOn"];

// D1 = snake_case, API = camelCase (02_contrats/01_CONVENTIONS_NOMMAGE.md).
// Ces tables associatives sont la seule définition de la correspondance
// des valeurs d'énumération dans les deux sens.
const STATUS_DB_TO_API: Record<string, ApiIssueStatus> = {
  new: "new",
  in_progress: "inProgress",
  waiting: "waiting",
  resolved: "resolved",
};

export const STATUS_API_TO_DB: Record<ApiIssueStatus, string> = {
  new: "new",
  inProgress: "in_progress",
  waiting: "waiting",
  resolved: "resolved",
};

const CAUSE_STATUS_DB_TO_API: Record<string, ApiCauseStatus> = {
  to_verify: "toVerify",
  known: "known",
};

export const CAUSE_STATUS_API_TO_DB: Record<ApiCauseStatus, string> = {
  toVerify: "to_verify",
  known: "known",
};

const PERMANENT_CORRECTION_TYPE_DB_TO_API: Record<string, ApiPermanentCorrectionType> = {
  procedure_update: "procedureUpdate",
  new_procedure: "newProcedure",
  training: "training",
  system_configuration: "systemConfiguration",
  responsibility_change: "responsibilityChange",
  additional_check: "additionalCheck",
  supplier_process: "supplierProcess",
  no_change_required: "noChangeRequired",
  other: "other",
};

export const PERMANENT_CORRECTION_TYPE_API_TO_DB: Record<ApiPermanentCorrectionType, string> = {
  procedureUpdate: "procedure_update",
  newProcedure: "new_procedure",
  training: "training",
  systemConfiguration: "system_configuration",
  responsibilityChange: "responsibility_change",
  additionalCheck: "additional_check",
  supplierProcess: "supplier_process",
  noChangeRequired: "no_change_required",
  other: "other",
};

export interface IssueRow {
  id: number;
  occurred_on: string;
  created_at: string;
  updated_at: string;
  row_version: number;
  created_by_user_id: number;
  location_id: number;
  department_id: number | null;
  category_id: number;
  subcategory_id: number | null;
  description: string;
  priority: string;
  status: string;
  owner_user_id: number | null;
  due_date: string | null;
  cause_status: string | null;
  cause_summary: string | null;
  immediate_solution: string | null;
  permanent_correction_type: string | null;
  permanent_correction_summary: string | null;
  waiting_on_type: string | null;
  waiting_on_user_id: number | null;
  waiting_on_label: string | null;
  final_result: string | null;
  prevention_learning: string | null;
  effectiveness_status: string | null;
  effectiveness_review_date: string | null;
  resolved_at: string | null;
  resolved_by_user_id: number | null;
  redacted_at: string | null;
  redacted_by_user_id: number | null;
  redaction_reason: string | null;
}

const ISSUE_COLUMNS =
  "id, occurred_on, created_at, updated_at, row_version, created_by_user_id, location_id, " +
  "department_id, category_id, subcategory_id, description, priority, status, owner_user_id, " +
  "due_date, cause_status, cause_summary, immediate_solution, permanent_correction_type, " +
  "permanent_correction_summary, waiting_on_type, waiting_on_user_id, waiting_on_label, " +
  "final_result, prevention_learning, effectiveness_status, effectiveness_review_date, " +
  "resolved_at, resolved_by_user_id, redacted_at, redacted_by_user_id, redaction_reason";

function mapWaitingOn(row: IssueRow): ApiWaitingOn | null {
  if (row.waiting_on_type === null) {
    return null;
  }
  if (row.waiting_on_type === "user") {
    return {
      type: "user",
      userId: row.waiting_on_user_id as number,
      label: row.waiting_on_label,
    };
  }
  return {
    type: row.waiting_on_type as "customer" | "supplier" | "other",
    userId: row.waiting_on_user_id,
    label: row.waiting_on_label as string,
  };
}

export function mapIssueRow(row: IssueRow): ApiIssue {
  return {
    publicId: toPublicId(row.id),
    occurredOn: row.occurred_on,
    locationId: row.location_id,
    departmentId: row.department_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    description: row.description,
    priority: row.priority as ApiIssue["priority"],
    status: STATUS_DB_TO_API[row.status],
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    causeStatus: row.cause_status ? CAUSE_STATUS_DB_TO_API[row.cause_status] : null,
    causeSummary: row.cause_summary,
    immediateSolution: row.immediate_solution,
    permanentCorrectionType: row.permanent_correction_type
      ? PERMANENT_CORRECTION_TYPE_DB_TO_API[row.permanent_correction_type]
      : null,
    permanentCorrectionSummary: row.permanent_correction_summary,
    waitingOn: mapWaitingOn(row),
    finalResult: row.final_result,
    preventionLearning: row.prevention_learning,
    effectivenessStatus: row.effectiveness_status as ApiIssue["effectivenessStatus"],
    effectivenessReviewDate: row.effectiveness_review_date,
    rowVersion: row.row_version,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedByUserId: row.resolved_by_user_id,
    redactedAt: row.redacted_at,
    redactedByUserId: row.redacted_by_user_id,
    redactionReason: row.redaction_reason,
  };
}

export async function findIssueByPublicId(db: D1Database, publicId: string): Promise<ApiIssue | null> {
  const id = parsePublicId(publicId);
  if (id === null) {
    return null;
  }
  const row = await db.prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE id = ?`).bind(id).first<IssueRow>();
  return row ? mapIssueRow(row) : null;
}

export interface NewIssueImpact {
  impactTypeId: number;
  details: string | null;
}

export interface NewIssueInput {
  occurredOn: string;
  createdByUserId: number;
  locationId: number;
  departmentId: number | null;
  categoryId: number;
  subcategoryId: number | null;
  description: string;
  priority: string;
  impacts: NewIssueImpact[];
}

/**
 * Insertion atomique du dossier + ses impacts en un seul db.batch()
 * (02_CONTRAT_D1.md : "opérations D1 transactionnelles/batch lorsque la
 * cohérence l'exige"). Le batch entier tourne dans une seule transaction
 * D1 ; les inserts d'impacts référencent l'id généré via
 * last_insert_rowid() en SQL plutôt qu'un id lu puis rebinding par
 * l'application, ce qui évite une fenêtre non atomique entre les deux
 * requêtes. La première instruction utilise RETURNING pour renvoyer la
 * ligne complète (avec les valeurs par défaut calculées par SQLite :
 * status, row_version, created_at, updated_at).
 */
export async function insertIssue(db: D1Database, input: NewIssueInput): Promise<ApiIssue> {
  const issueInsert = db
    .prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, department_id, category_id, subcategory_id, description, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${ISSUE_COLUMNS}`
    )
    .bind(
      input.occurredOn,
      input.createdByUserId,
      input.locationId,
      input.departmentId,
      input.categoryId,
      input.subcategoryId,
      input.description,
      input.priority
    );

  const impactInserts = input.impacts.map((impact) =>
    db
      .prepare(
        `INSERT INTO issue_impacts (issue_id, impact_type_id, details)
         SELECT last_insert_rowid(), ?, ?`
      )
      .bind(impact.impactTypeId, impact.details)
  );

  const results = await db.batch([issueInsert, ...impactInserts]);
  const row = results[0].results[0] as IssueRow;
  return mapIssueRow(row);
}
