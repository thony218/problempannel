import type { components } from "../../src/shared/api-types.generated";

export type ApiCauseStatus = components["schemas"]["CauseStatus"];
export type ApiPermanentCorrectionType = components["schemas"]["PermanentCorrectionType"];
export type ApiEffectivenessStatus = components["schemas"]["EffectivenessStatus"];

export interface ResolutionPreconditionsParams {
  causeStatus: ApiCauseStatus | null | undefined;
  causeSummary: string | null | undefined;
  permanentCorrectionType: ApiPermanentCorrectionType | null | undefined;
  permanentCorrectionSummary: string | null | undefined;
  finalResult: string | null | undefined;
  preventionLearning: string | null | undefined;
  effectivenessStatus: ApiEffectivenessStatus | null | undefined;
  openBlockingActionsCount: number;
}

/**
 * Valide les préconditions obligatoires lors de la résolution d'un dossier (FLOW-03, 01_CONTRAT_FONCTIONNEL_FINAL §5).
 * Retourne un objet Record<string, string> contenant les erreurs par champ si applicable.
 */
export function validateResolutionPreconditions(
  params: ResolutionPreconditionsParams
): Record<string, string> {
  const fields: Record<string, string> = {};

  if (!params.causeStatus) {
    fields.causeStatus = "Le statut de la cause est requis pour résoudre le dossier.";
  }
  if (!params.causeSummary || params.causeSummary.trim().length === 0) {
    fields.causeSummary = "Le résumé de la cause est requis pour résoudre le dossier.";
  }
  if (!params.permanentCorrectionType) {
    fields.permanentCorrectionType = "Le type de correction permanente est requis pour résoudre le dossier.";
  }
  if (!params.permanentCorrectionSummary || params.permanentCorrectionSummary.trim().length === 0) {
    fields.permanentCorrectionSummary = "Le résumé de la correction permanente est requis pour résoudre le dossier.";
  }
  if (!params.finalResult || params.finalResult.trim().length === 0) {
    fields.finalResult = "Le résultat final est requis pour résoudre le dossier.";
  }
  if (!params.preventionLearning || params.preventionLearning.trim().length === 0) {
    fields.preventionLearning = "L'apprentissage / mesure préventive est requis pour résoudre le dossier.";
  }
  if (!params.effectivenessStatus) {
    fields.effectivenessStatus = "Le statut d'évaluation de l'efficacité est requis pour résoudre le dossier.";
  }

  if (params.openBlockingActionsCount > 0) {
    fields.status = `Impossible de résoudre le dossier : ${params.openBlockingActionsCount} action(s) corrective(s) bloquante(s) non terminée(s).`;
  }

  return fields;
}

/**
 * Calcule la date de révision d'efficacité par défaut à +30 jours (D-29 / S12).
 * Format ISO AAAA-MM-JJ (YYYY-MM-DD).
 */
export function computeDefaultReviewDate(baseDate: Date = new Date()): string {
  const target = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}
