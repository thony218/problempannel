import type { components } from "../../src/shared/api-types.generated";
import { addCalendarDays, businessToday } from "./config";

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

export const DEFAULT_REVIEW_DELAY_DAYS = 30;

/**
 * Date de révision d'efficacité par défaut : +30 jours après la date **métier**
 * courante (D-29 / S12). Format AAAA-MM-JJ.
 *
 * Le calcul part de la date métier (et non de `Date.now()` en UTC) puis ajoute
 * des jours calendaires : une résolution saisie à 21 h à Montréal ne doit pas
 * produire une échéance datée du lendemain, et un passage à l'heure avancée
 * dans l'intervalle ne doit pas décaler le résultat.
 */
export function computeDefaultReviewDate(timeZone: string, now: Date = new Date()): string {
  return addCalendarDays(businessToday(timeZone, now), DEFAULT_REVIEW_DELAY_DAYS);
}
