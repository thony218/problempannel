/**
 * Chemins de l'application, définis une seule fois.
 *
 * 01_produit/ux/01_NAVIGATION_ET_ARBORESCENCE.md impose deux propriétés que
 * seule une URL peut porter : « une URL dossier doit ouvrir directement le
 * détail après authentification » (lien profond) et « les filtres du Registre
 * doivent vivre dans l'URL afin que refresh/retour navigateur ne les perde
 * pas ».
 *
 * Les libellés sont en français parce que ces URL sont visibles par les
 * employés et se partagent entre collègues.
 */
export const PATHS = {
  root: "/",
  home: "/accueil",
  newIssue: "/nouveau",
  registry: "/registre",
  issueDetail: "/dossiers/:publicId",
  analytics: "/analyse",
  admin: "/administration",
} as const;

/** URL du détail d'un dossier, seule forme à utiliser pour naviguer. */
export function issueDetailPath(publicId: string): string {
  return `/dossiers/${encodeURIComponent(publicId)}`;
}
