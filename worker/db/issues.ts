import type { components } from "../../src/shared/api-types.generated";
import { parsePublicId, toPublicId } from "../domain/publicId";
import { insertHistoryEventForJustCreatedIssueStatement } from "./history";

export type ApiIssue = components["schemas"]["Issue"];
export type ApiIssueStatus = components["schemas"]["IssueStatus"];
export type ApiCauseStatus = components["schemas"]["CauseStatus"];
export type ApiPermanentCorrectionType = components["schemas"]["PermanentCorrectionType"];
export type ApiWaitingOn = components["schemas"]["WaitingOn"];

// D1 = snake_case, API = camelCase (02_contrats/01_CONVENTIONS_NOMMAGE.md).
// Ces tables associatives sont la seule définition de la correspondance
// des valeurs d'énumération dans les deux sens.
export const STATUS_DB_TO_API: Record<string, ApiIssueStatus> = {
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

export const CAUSE_STATUS_DB_TO_API: Record<string, ApiCauseStatus> = {
  to_verify: "toVerify",
  known: "known",
};

export const CAUSE_STATUS_API_TO_DB: Record<ApiCauseStatus, string> = {
  toVerify: "to_verify",
  known: "known",
};

export const PERMANENT_CORRECTION_TYPE_DB_TO_API: Record<string, ApiPermanentCorrectionType> = {
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

/** Ligne brute (pas de mapping API) — utilisé par le PATCH pour lire row_version/valeurs courantes. */
export async function findIssueRowById(db: D1Database, id: number): Promise<IssueRow | null> {
  return db.prepare(`SELECT ${ISSUE_COLUMNS} FROM issues WHERE id = ?`).bind(id).first<IssueRow>();
}

export interface IssueColumnUpdates {
  occurred_on?: string;
  location_id?: number;
  department_id?: number | null;
  category_id?: number;
  subcategory_id?: number | null;
  description?: string;
  priority?: string;
  status?: string;
  owner_user_id?: number | null;
  due_date?: string | null;
  cause_status?: string | null;
  cause_summary?: string | null;
  immediate_solution?: string | null;
  permanent_correction_type?: string | null;
  permanent_correction_summary?: string | null;
  waiting_on_type?: string | null;
  waiting_on_user_id?: number | null;
  waiting_on_label?: string | null;
  final_result?: string | null;
  prevention_learning?: string | null;
  effectiveness_status?: string | null;
  effectiveness_review_date?: string | null;
  resolved_by_user_id?: number | null;
}

export interface UpdateIssueRowOptions {
  /** `resolved_at` doit refléter le statut courant, pas une valeur soumise par le client (horloge D1, pas worker). */
  touchResolvedAtNow?: boolean;
  clearResolvedAt?: boolean;
}

/**
 * UPDATE optimiste, renvoyé **non exécuté** : l'appelant le place en dernier
 * dans un `db.batch()` avec les écritures de suivi (impacts, historique), de
 * sorte que la modification et sa trace d'audit soient une seule transaction.
 *
 * La clause `WHERE id = ? AND row_version = ?` est le dernier rempart contre
 * une course entre la lecture du `If-Match` côté service et cette écriture :
 * un service qui ne relit qu'au préalable laisse une fenêtre ouverte. Si
 * aucune ligne ne correspond (version périmée ou id disparu), le `RETURNING`
 * ne produit rien et le service traduit ça en 409.
 */
export function updateIssueRowStatement(
  db: D1Database,
  id: number,
  expectedRowVersion: number,
  columns: IssueColumnUpdates,
  options: UpdateIssueRowOptions = {}
): D1PreparedStatement {
  const keys = Object.keys(columns) as (keyof IssueColumnUpdates)[];
  const setClauses = keys.map((key) => `${key} = ?`);
  const values: unknown[] = keys.map((key) => columns[key]);

  if (options.touchResolvedAtNow) {
    setClauses.push("resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  } else if (options.clearResolvedAt) {
    setClauses.push("resolved_at = NULL");
  }

  setClauses.push("row_version = row_version + 1");
  setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");

  return db
    .prepare(
      `UPDATE issues SET ${setClauses.join(", ")} WHERE id = ? AND row_version = ? RETURNING ${ISSUE_COLUMNS}`
    )
    .bind(...values, id, expectedRowVersion);
}

/**
 * Remplace intégralement les impacts d'un dossier existant (id déjà connu,
 * contrairement à insertIssue où l'id n'existe pas encore). `impacts` est
 * garanti non vide par le schéma Zod (min 1) quand ce champ est fourni.
 *
 * Les deux statements portent le même garde de version que l'UPDATE qui les
 * suit dans le batch : si la version a bougé, ils ne font rien plutôt que de
 * remplacer les impacts d'une modification qui sera rejetée en 409.
 */
export function replaceIssueImpactsStatements(
  db: D1Database,
  issueId: number,
  impacts: NewIssueImpact[],
  expectedRowVersion: number
): D1PreparedStatement[] {
  const guard = "EXISTS (SELECT 1 FROM issues WHERE id = ? AND row_version = ?)";

  const del = db
    .prepare(`DELETE FROM issue_impacts WHERE issue_id = ? AND ${guard}`)
    .bind(issueId, issueId, expectedRowVersion);

  const placeholders = impacts.map(() => "(?, ?, ?)").join(", ");
  const insert = db
    .prepare(
      `INSERT INTO issue_impacts (issue_id, impact_type_id, details)
       SELECT column1, column2, column3 FROM (VALUES ${placeholders})
       WHERE ${guard}`
    )
    .bind(
      ...impacts.flatMap((impact) => [issueId, impact.impactTypeId, impact.details]),
      issueId,
      expectedRowVersion
    );

  return [del, insert];
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
 * Insertion atomique du dossier + ses impacts + l'événement d'historique
 * `issue_created` en un seul db.batch() (02_CONTRAT_D1.md : "opérations
 * D1 transactionnelles/batch lorsque la cohérence l'exige").
 *
 * Les inserts enfants (impacts, historique) retrouvent l'id du dossier
 * via `(SELECT id FROM issues ORDER BY id DESC LIMIT 1)` plutôt que
 * `last_insert_rowid()` : ce dernier change dès qu'une AUTRE instruction
 * du même batch insère une ligne (ex: le 2e impact verrait l'id généré
 * par le 1er impact, pas celui du dossier — bug réel trouvé et corrigé
 * ici, voir JOURNAL_TRAVAIL.md). La sous-requête est sûre parce qu'un
 * batch D1 est une transaction atomique : aucune autre écriture ne peut
 * s'intercaler, donc "le dossier au plus grand id" désigne forcément
 * celui qu'on vient de créer, peu importe l'ordre des statements enfants.
 * Les impacts sont insérés en une seule instruction multi-lignes (VALUES)
 * pour ne dépendre que d'une seule évaluation de cette sous-requête.
 *
 * La première instruction utilise RETURNING pour renvoyer la ligne
 * complète (avec les valeurs par défaut calculées par SQLite : status,
 * row_version, created_at, updated_at).
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

  // SQLite ne supporte pas la syntaxe standard "AS v(col1, col2)" pour
  // nommer les colonnes d'une table dérivée VALUES(...) : on utilise donc
  // les noms de colonnes par défaut column1/column2 qu'il assigne lui-même.
  const impactValuesPlaceholders = input.impacts.map(() => "(?, ?)").join(", ");
  const impactsInsert = db
    .prepare(
      `INSERT INTO issue_impacts (issue_id, impact_type_id, details)
       SELECT (SELECT id FROM issues ORDER BY id DESC LIMIT 1), column1, column2
       FROM (VALUES ${impactValuesPlaceholders})`
    )
    .bind(...input.impacts.flatMap((impact) => [impact.impactTypeId, impact.details]));

  const historyInsert = insertHistoryEventForJustCreatedIssueStatement(db, {
    actorUserId: input.createdByUserId,
    eventType: "issue_created",
    payload: {
      locationId: input.locationId,
      departmentId: input.departmentId,
      categoryId: input.categoryId,
      subcategoryId: input.subcategoryId,
      priority: input.priority,
    },
  });

  const results = await db.batch([issueInsert, impactsInsert, historyInsert]);
  const row = results[0].results[0] as IssueRow;
  return mapIssueRow(row);
}

export interface ListIssuesDbParams {
  cursorId?: number | null;
  limit: number;
  q?: string;
  status?: ApiIssueStatus[];
  priority?: string[];
  locationId?: number;
  departmentId?: number;
  categoryId?: number;
  ownerUserId?: number;
  from?: string;
  to?: string;
  overdue?: boolean;
  /** Date métier courante (AAAA-MM-JJ), requise dès que `overdue` est actif. */
  businessToday: string;
  effectivenessStatus?: string;
  effectivenessReviewDueBefore?: string;
}

export interface ListIssuesDbResult {
  rows: IssueRow[];
  hasMore: boolean;
}

/**
 * Exécute une requête filtrée, recherchée et paginée par curseur opaque sur issues.
 * Utilise toujours une clause préparée avec placeholders pour éviter toute injection.
 */
export async function queryIssuesList(
  db: D1Database,
  params: ListIssuesDbParams
): Promise<ListIssuesDbResult> {
  const whereClauses: string[] = [];
  const bindings: unknown[] = [];

  if (typeof params.cursorId === "number" && params.cursorId > 0) {
    whereClauses.push("id < ?");
    bindings.push(params.cursorId);
  }

  if (params.status && params.status.length > 0) {
    const dbStatuses = params.status.map((s) => STATUS_API_TO_DB[s]).filter(Boolean);
    if (dbStatuses.length > 0) {
      const placeholders = dbStatuses.map(() => "?").join(", ");
      whereClauses.push(`status IN (${placeholders})`);
      bindings.push(...dbStatuses);
    }
  }

  if (params.priority && params.priority.length > 0) {
    const placeholders = params.priority.map(() => "?").join(", ");
    whereClauses.push(`priority IN (${placeholders})`);
    bindings.push(...params.priority);
  }

  if (params.locationId) {
    whereClauses.push("location_id = ?");
    bindings.push(params.locationId);
  }

  if (params.departmentId) {
    whereClauses.push("department_id = ?");
    bindings.push(params.departmentId);
  }

  if (params.categoryId) {
    whereClauses.push("category_id = ?");
    bindings.push(params.categoryId);
  }

  if (params.ownerUserId) {
    whereClauses.push("owner_user_id = ?");
    bindings.push(params.ownerUserId);
  }

  if (params.from) {
    whereClauses.push("occurred_on >= ?");
    bindings.push(params.from);
  }

  if (params.to) {
    whereClauses.push("occurred_on <= ?");
    bindings.push(params.to);
  }

  if (params.overdue) {
    // `date('now')` serait la date UTC ; 08_DEFINITIONS_ANALYTIQUES.md impose
    // la « date métier courante », fournie par l'appelant.
    whereClauses.push("due_date IS NOT NULL AND date(due_date) < date(?) AND status != 'resolved'");
    bindings.push(params.businessToday);
  }

  if (params.effectivenessStatus) {
    whereClauses.push("effectiveness_status = ?");
    bindings.push(params.effectivenessStatus);
  }

  if (params.effectivenessReviewDueBefore) {
    whereClauses.push(
      "status = 'resolved' AND effectiveness_status = 'pending' AND effectiveness_review_date IS NOT NULL AND date(effectiveness_review_date) <= date(?)"
    );
    bindings.push(params.effectivenessReviewDueBefore);
  }

  if (params.q && params.q.trim().length > 0) {
    const trimmed = params.q.trim();
    const parsedId = parsePublicId(trimmed);
    const numericId =
      !isNaN(Number(trimmed)) && Number.isInteger(Number(trimmed)) && Number(trimmed) > 0
        ? Number(trimmed)
        : null;
    const targetId = parsedId ?? numericId;

    const escaped = trimmed.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const likePattern = `%${escaped}%`;

    if (targetId !== null) {
      whereClauses.push("(id = ? OR description LIKE ? ESCAPE '\\')");
      bindings.push(targetId, likePattern);
    } else {
      whereClauses.push("description LIKE ? ESCAPE '\\'");
      bindings.push(likePattern);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const fetchLimit = params.limit + 1;
  const sql = `SELECT ${ISSUE_COLUMNS} FROM issues ${whereSql} ORDER BY id DESC LIMIT ?`;
  bindings.push(fetchLimit);

  const stmt = db.prepare(sql).bind(...bindings);
  const result = await stmt.all<IssueRow>();
  const rows = result.results || [];

  const hasMore = rows.length > params.limit;
  const pageRows = hasMore ? rows.slice(0, params.limit) : rows;

  return {
    rows: pageRows,
    hasMore,
  };
}

