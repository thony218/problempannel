import type { components } from "../../src/shared/api-types.generated";
import { AppError } from "../domain/errors";
import { parsePublicId } from "../domain/publicId";
import { decodeCursor, encodeCursor } from "../domain/cursor";
import { findIssueRowById } from "../db/issues";
import { findHistoryByIssueId, mapHistoryRow, type ApiHistoryEvent } from "../db/history";

export interface HistoryListResult {
  items: ApiHistoryEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function listIssueHistory(
  db: D1Database,
  publicId: string,
  query: { cursor?: string; limit: number }
): Promise<HistoryListResult | null> {
  const issueId = parsePublicId(publicId);
  if (issueId === null) return null;

  const issue = await findIssueRowById(db, issueId);
  if (!issue) return null;

  let cursorId: number | undefined;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor);
    if (!decoded) {
      throw new AppError("BAD_REQUEST", "Curseur de pagination invalide.");
    }
    cursorId = decoded.id;
  }

  const { rows, hasMore, nextCursorId } = await findHistoryByIssueId(db, issueId, {
    cursorId,
    limit: query.limit,
  });

  const nextCursor = nextCursorId ? encodeCursor({ id: nextCursorId }) : null;

  return {
    items: rows.map(mapHistoryRow),
    nextCursor,
    hasMore,
  };
}
