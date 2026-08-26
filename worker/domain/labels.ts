import type { components } from "../../src/shared/api-types.generated";
import type { UpdateIssueInput } from "../validation/issues";
import { ISSUE_STATUS_LABELS } from "../../src/shared/issueLabels";

export type ApiIssueStatus = components["schemas"]["IssueStatus"];

/**
 * Libellés destinés aux personnes, pour les messages d'erreur du Worker.
 *
 * `01_produit/ux/05_ETATS_ET_MESSAGES.md` veut des messages lisibles par
 * l'utilisateur. Les messages de validation remontent maintenant jusqu'à
 * l'écran (`describeApiError`, correctif QA-04), donc tout identifiant
 * technique laissé dans un message est désormais lu par un gestionnaire :
 * la recette du 2026-08-26 a montré « Sous-catégorie requise pour sortir du
 * statut 'new'. » affiché tel quel dans la modale d'édition.
 *
 * Le tableau lui-même vit dans `src/shared/issueLabels.ts`, partagé avec les
 * écrans : voir le commentaire qui s'y trouve pour la raison.
 */
export { ISSUE_STATUS_LABELS };

/** Libellé d'un statut, encadré des guillemets français utilisés par les écrans. */
export function statusLabel(status: ApiIssueStatus): string {
  return `« ${ISSUE_STATUS_LABELS[status]} »`;
}

/**
 * Libellés des champs modifiables d'un dossier.
 *
 * Les messages de permission nommaient le champ par sa clé d'API
 * (`permanentCorrectionSummary`), ce qui n'a de sens que pour qui lit le
 * contrat. Seuls les champs cités dans un message d'erreur figurent ici.
 */
export const ISSUE_FIELD_LABELS: Partial<Record<keyof UpdateIssueInput, string>> = {
  priority: "Priorité",
  ownerUserId: "Responsable assigné",
  errorActorUserId: "Employé concerné par l'erreur",
  dueDate: "Date d'échéance",
  causeStatus: "Statut de la cause",
  causeSummary: "Résumé de la cause",
  immediateSolution: "Solution immédiate",
  permanentCorrectionType: "Type de correction permanente",
  permanentCorrectionSummary: "Résumé de la correction permanente",
  finalResult: "Résultat final",
  preventionLearning: "Apprentissages & Prévention",
  effectivenessStatus: "Statut d'efficacité",
  effectivenessReviewDate: "Date de révision de l'efficacité",
  occurredOn: "Date de survenance",
  locationId: "Succursale",
  departmentId: "Département",
  categoryId: "Catégorie",
  subcategoryId: "Sous-catégorie",
  description: "Description des faits",
  impacts: "Impacts constatés",
};

/**
 * Libellé d'un champ, avec repli sur la clé brute.
 *
 * Le repli est volontaire : un champ ajouté au contrat sans être ajouté ici
 * produira un message imparfait, jamais un message vide ou un plantage.
 */
export function fieldLabel(field: keyof UpdateIssueInput): string {
  return `« ${ISSUE_FIELD_LABELS[field] ?? field} »`;
}
