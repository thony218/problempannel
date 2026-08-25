import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiHistoryEvent = components["schemas"]["HistoryEvent"];

export interface HistoryRow {
  id: number;
  issue_id: number;
  actor_user_id: number;
  event_type: string;
  payload_json: string;
  created_at: string;
}

export function mapHistoryRow(row: HistoryRow): ApiHistoryEvent {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload_json);
  } catch {
    // Ignore JSON errors
  }

  return {
    id: row.id,
    issuePublicId: toPublicId(row.issue_id),
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    payload,
    createdAt: row.created_at,
  };
}

export interface NewHistoryEvent {
  actorUserId: number;
  eventType: string;
  /**
   * Métadonnées structurelles uniquement (ids, enums, noms de champ).
   * Ne jamais y mettre un texte libre modifiable (description,
   * causeSummary, commentaire, ...) — cf. 01_produit/09_CAVIARDAGE_ET_
   * HISTORIQUE.md : l'historique enregistre qu'un champ a changé, jamais
   * son contenu.
   */
  payload?: Record<string, unknown>;
}

/** À utiliser quand l'id du dossier est déjà connu (PATCH, commentaires, ...). */
export function insertHistoryEventStatement(db: D1Database, issueId: number, event: NewHistoryEvent) {
  return db
    .prepare(
      "INSERT INTO issue_history (issue_id, actor_user_id, event_type, payload_json) VALUES (?, ?, ?, ?)"
    )
    .bind(issueId, event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {}));
}

/**
 * À utiliser uniquement dans le même db.batch() que la création du
 * dossier, où l'id n'est pas encore connu côté application (RETURNING
 * n'est lu qu'après l'exécution complète du batch). Sûr car un batch D1
 * est une transaction atomique : aucune autre écriture ne peut
 * s'intercaler entre l'insertion du dossier et cette sous-requête, donc
 * "le dossier avec le plus grand id" désigne forcément celui qu'on vient
 * de créer.
 */
export function insertHistoryEventForJustCreatedIssueStatement(db: D1Database, event: NewHistoryEvent) {
  return db
    .prepare(
      `INSERT INTO issue_history (issue_id, actor_user_id, event_type, payload_json)
       SELECT id, ?, ?, ? FROM issues ORDER BY id DESC LIMIT 1`
    )
    .bind(event.actorUserId, event.eventType, JSON.stringify(event.payload ?? {}));
}

export async function findHistoryByIssueId(
  db: D1Database,
  issueId: number,
  params: { cursorId?: number; limit: number }
): Promise<{ rows: HistoryRow[]; hasMore: boolean; nextCursorId: number | null }> {
  const { cursorId, limit } = params;
  let query = `
    SELECT id, issue_id, actor_user_id, event_type, payload_json, created_at
    FROM issue_history
    WHERE issue_id = ?
  `;
  const binds: (number | string)[] = [issueId];

  if (cursorId !== undefined) {
    query += " AND id > ?";
    binds.push(cursorId);
  }

  query += " ORDER BY id ASC LIMIT ?";
  binds.push(limit + 1);

  const result = await db.prepare(query).bind(...binds).all<HistoryRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const slicedRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursorId = hasMore && slicedRows.length > 0 ? slicedRows[slicedRows.length - 1].id : null;

  return { rows: slicedRows, hasMore, nextCursorId };
}
