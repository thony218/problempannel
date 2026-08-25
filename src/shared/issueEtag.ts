/**
 * Construit le validateur fort d'un dossier depuis les données du corps.
 *
 * Le repli est volontaire : un intermédiaire HTTP peut retirer ou affaiblir
 * un ETag de réponse. `rowVersion` demeure la source de vérité métier et
 * permet au client d'envoyer un If-Match fort conforme sans désactiver la
 * protection de concurrence.
 */
export function issueEtag(publicId: string, rowVersion: number): string {
  const match = /^INC-(\d{6,})$/.exec(publicId);
  if (!match) throw new Error("Numéro de dossier invalide pour construire l'ETag.");
  return `"issue-${Number(match[1])}-v${rowVersion}"`;
}

export function responseIssueEtag(
  responseHeader: string | null,
  publicId: string,
  rowVersion: number
): string {
  if (responseHeader && /^"issue-\d+-v\d+"$/.test(responseHeader)) return responseHeader;
  return issueEtag(publicId, rowVersion);
}
