import type { components } from "./api-types.generated";

export type IssueStatus = components["schemas"]["IssueStatus"];

/**
 * Libellés des statuts, partagés par les écrans et par les messages d'erreur
 * du Worker.
 *
 * Ils vivent ici et non de chaque côté parce que la recette du 2026-08-26 a
 * montré le coût de la divergence : le serveur répondait « Sous-catégorie
 * requise pour sortir du statut 'new'. » pendant que le sélecteur juste à
 * côté affichait « Nouveau ». Un message d'erreur qui nomme un statut
 * autrement que l'écran qui l'affiche est pire qu'un identifiant brut — il
 * laisse croire à deux notions différentes.
 *
 * Une seule définition rend cette divergence impossible, là où un test de
 * cohérence n'aurait fait que la signaler après coup.
 */
export const ISSUE_STATUS_LABELS: Record<IssueStatus, string> = {
  new: "Nouveau",
  inProgress: "En cours",
  waiting: "En attente",
  resolved: "Résolu",
};

/** Statuts dans l'ordre du cycle de vie, pour construire les sélecteurs. */
export const ISSUE_STATUS_ORDER: IssueStatus[] = ["new", "inProgress", "waiting", "resolved"];
