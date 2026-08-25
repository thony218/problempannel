import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiCorrectiveAction = components["schemas"]["CorrectiveAction"];
export type ApiCorrectiveActionStatus = components["schemas"]["CorrectiveActionStatus"];
export type ApiEffectivenessStatus = components["schemas"]["EffectivenessStatus"];

// D1 = snake_case, API = camelCase (02_contrats/01_CONVENTIONS_NOMMAGE.md).
export const STATUS_DB_TO_API: Record<string, ApiCorrectiveActionStatus> = {
  todo: "todo",
  in_progress: "inProgress",
  waiting: "waiting",
  done: "done",
};

export const STATUS_API_TO_DB: Record<ApiCorrectiveActionStatus, string> = {
  todo: "todo",
  inProgress: "in_progress",
  waiting: "waiting",
  done: "done",
};

export interface CorrectiveActionRow {
  id: number;
  issue_id: number;
  title: string;
  description: string | null;
  owner_user_id: number;
  due_date: string;
  status: string;
  blocks_issue_closure: number;
  result: string | null;
  effectiveness_status: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapCorrectiveActionRow(row: CorrectiveActionRow): ApiCorrectiveAction {
  return {
    id: row.id,
    issuePublicId: toPublicId(row.issue_id),
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    status: STATUS_DB_TO_API[row.status] || "todo",
    blocksIssueClosure: row.blocks_issue_closure === 1,
    result: row.result,
    effectivenessStatus: row.effectiveness_status as ApiEffectivenessStatus | null,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findCorrectiveActionsByIssueId(
  db: D1Database,
  issueId: number
): Promise<ApiCorrectiveAction[]> {
  const result = await db
    .prepare(
      `SELECT id, issue_id, title, description, owner_user_id, due_date, status, blocks_issue_closure,
              result, effectiveness_status, completed_at, created_at, updated_at
       FROM corrective_actions WHERE issue_id = ? ORDER BY id ASC`
    )
    .bind(issueId)
    .all<CorrectiveActionRow>();

  return (result.results || []).map(mapCorrectiveActionRow);
}

export async function findCorrectiveActionById(
  db: D1Database,
  id: number
): Promise<CorrectiveActionRow | null> {
  const result = await db
    .prepare(
      `SELECT id, issue_id, title, description, owner_user_id, due_date, status, blocks_issue_closure,
              result, effectiveness_status, completed_at, created_at, updated_at
       FROM corrective_actions WHERE id = ?`
    )
    .bind(id)
    .first<CorrectiveActionRow>();

  return result || null;
}

export async function countOpenBlockingCorrectiveActions(
  db: D1Database,
  issueId: number
): Promise<number> {
  const result = await db
    .prepare(
      `SELECT COUNT(*) as count FROM corrective_actions WHERE issue_id = ? AND blocks_issue_closure = 1 AND status != 'done'`
    )
    .bind(issueId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

/** Statement d'insertion, à grouper avec son événement d'historique (G-007). */
export function insertCorrectiveActionStatement(
  db: D1Database,
  data: {
    issueId: number;
    title: string;
    description?: string | null;
    ownerUserId: number;
    dueDate: string;
    status: string;
    blocksIssueClosure: boolean;
  }
): D1PreparedStatement {
  const completedAt = data.status === "done" ? new Date().toISOString() : null;

  return db
    .prepare(
      `INSERT INTO corrective_actions (
         issue_id, title, description, owner_user_id, due_date, status,
         blocks_issue_closure, completed_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id, issue_id, title, description, owner_user_id, due_date, status,
                 blocks_issue_closure, result, effectiveness_status, completed_at, created_at, updated_at`
    )
    .bind(
      data.issueId,
      data.title,
      data.description ?? null,
      data.ownerUserId,
      data.dueDate,
      data.status,
      data.blocksIssueClosure ? 1 : 0,
      completedAt
    );
}

export interface CorrectiveActionColumnUpdates {
  title?: string;
  description?: string | null;
  owner_user_id?: number;
  due_date?: string;
  status?: string;
  blocks_issue_closure?: number;
  result?: string | null;
  effectiveness_status?: string | null;
  completed_at?: string | null;
}

/** Statement de mise à jour, à grouper avec son événement d'historique (G-007). */
export function updateCorrectiveActionRowStatement(
  db: D1Database,
  id: number,
  updates: CorrectiveActionColumnUpdates
): D1PreparedStatement {
  const keys = Object.keys(updates) as (keyof CorrectiveActionColumnUpdates)[];
  const setClauses = keys.map((k) => `${k} = ?`);
  setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  const values = keys.map((k) => updates[k]);

  const query = `
    UPDATE corrective_actions
    SET ${setClauses.join(", ")}
    WHERE id = ?
    RETURNING id, issue_id, title, description, owner_user_id, due_date, status,
              blocks_issue_closure, result, effectiveness_status, completed_at, created_at, updated_at
  `;

  return db.prepare(query).bind(...values, id);
}
