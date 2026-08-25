export interface IssueCursorPayload {
  id: number;
  sort?: "newest" | "oldest" | "priority" | "dueDate";
  sortKey?: number | string | null;
}

/**
 * Encode un payload de curseur en chaîne opaque Base64URL.
 */
export function encodeCursor(payload: IssueCursorPayload): string {
  const json = JSON.stringify(payload);
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Décode et valide un curseur opaque Base64URL.
 * Retourne null si le curseur est invalide, malformé, ou contient un ID non conforme.
 */
export function decodeCursor(cursor: string): IssueCursorPayload | null {
  if (typeof cursor !== "string" || cursor.trim().length === 0) {
    return null;
  }
  try {
    let base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    const json = atob(base64);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || !Number.isInteger(parsed.id) || parsed.id <= 0) return null;

    if (parsed.sort === undefined) return { id: parsed.id };
    if (!["newest", "oldest", "priority", "dueDate"].includes(parsed.sort)) return null;

    if (parsed.sort === "priority") {
      if (!Number.isInteger(parsed.sortKey) || parsed.sortKey < 1 || parsed.sortKey > 3) return null;
      return { id: parsed.id, sort: parsed.sort, sortKey: parsed.sortKey };
    }
    if (parsed.sort === "dueDate") {
      if (parsed.sortKey !== null && (typeof parsed.sortKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.sortKey))) {
        return null;
      }
      return { id: parsed.id, sort: parsed.sort, sortKey: parsed.sortKey };
    }
    return { id: parsed.id, sort: parsed.sort };
  } catch {
    return null;
  }
}
