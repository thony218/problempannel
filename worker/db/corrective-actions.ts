import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiCorrectiveAction = components["schemas"]["CorrectiveAction"];
export type ApiCorrectiveActionStatus = components["schemas"]["CorrectiveActionStatus"];
export type ApiEffectivenessStatus = components["schemas"]["EffectivenessStatus"];

// D1 = snake_case, API = camelCase (02_contrats/01_CONVENTIONS_NOMMAGE.md).
const STATUS_DB_TO_API: Record<string, ApiCorrectiveActionStatus> = {
  todo: "todo",
  in_progress: "inProgress",
  waiting: "waiting",
  done: "done",
};

interface CorrectiveActionRow {
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

function mapCorrectiveActionRow(row: CorrectiveActionRow): ApiCorrectiveAction {
  return {
    id: row.id,
    issuePublicId: toPublicId(row.issue_id),
    title: row.title,
    description: row.description,
    ownerUserId: row.owner_user_id,
    dueDate: row.due_date,
    status: STATUS_DB_TO_API[row.status],
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

/**
 * Compte le nombre d'actions correctives bloquantes non terminées pour un dossier donné.
 * Une action bloque la résolution si blocks_issue_closure = 1 et status != 'done'.
 */
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

