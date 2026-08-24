export interface IssueCursorPayload {
  id: number;
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
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.id === "number" &&
      Number.isInteger(parsed.id) &&
      parsed.id > 0
    ) {
      return { id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}
