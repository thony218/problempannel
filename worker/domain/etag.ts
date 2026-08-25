/**
 * Format d'ETag du contrat API pour un dossier : `issue-{id}-v{rowVersion}`
 * (02_contrats/03_CONTRAT_API.md — utilisé par POST/GET/PATCH /issues).
 */
export function issueETag(id: number, rowVersion: number): string {
  // RFC 9110 : l'opaque-tag est obligatoirement entre guillemets. Cloudflare
  // retire les ETag mal formés, ce qui faisait perdre If-Match en production.
  return `"issue-${id}-v${rowVersion}"`;
}
