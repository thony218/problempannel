/**
 * Format d'ETag du contrat API pour un dossier : `issue-{id}-v{rowVersion}`
 * (02_contrats/03_CONTRAT_API.md — utilisé par POST/GET/PATCH /issues).
 */
export function issueETag(id: number, rowVersion: number): string {
  return `issue-${id}-v${rowVersion}`;
}
