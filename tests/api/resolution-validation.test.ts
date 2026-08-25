import { describe, expect, it } from "vitest";
import {
  computeDefaultReviewDate,
  validateResolutionPreconditions,
  type ResolutionPreconditionsParams,
} from "../../worker/domain/resolution";

describe("worker/domain/resolution", () => {
  const validCompleteParams: ResolutionPreconditionsParams = {
    causeStatus: "known",
    causeSummary: "Mauvaise manipulation lors du scan.",
    permanentCorrectionType: "procedureUpdate",
    permanentCorrectionSummary: "Mise à jour du mode opératoire de réception.",
    finalResult: "Procédure validée avec l'équipe.",
    preventionLearning: "Former les nouveaux arrivants systématiquement.",
    effectivenessStatus: "pending",
    openBlockingActionsCount: 0,
  };

  it("returns no errors when all 7 fields are valid and no open blocking actions", () => {
    const errors = validateResolutionPreconditions(validCompleteParams);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it("accumulates field errors for every missing or empty field", () => {
    const emptyParams: ResolutionPreconditionsParams = {
      causeStatus: null,
      causeSummary: "",
      permanentCorrectionType: null,
      permanentCorrectionSummary: "   ",
      finalResult: null,
      preventionLearning: "",
      effectivenessStatus: null,
      openBlockingActionsCount: 0,
    };

    const errors = validateResolutionPreconditions(emptyParams);
    expect(errors.causeStatus).toBeDefined();
    expect(errors.causeSummary).toBeDefined();
    expect(errors.permanentCorrectionType).toBeDefined();
    expect(errors.permanentCorrectionSummary).toBeDefined();
    expect(errors.finalResult).toBeDefined();
    expect(errors.preventionLearning).toBeDefined();
    expect(errors.effectivenessStatus).toBeDefined();
  });

  it("flags open blocking actions with error on status field (S11)", () => {
    const paramsWithBlocking: ResolutionPreconditionsParams = {
      ...validCompleteParams,
      openBlockingActionsCount: 2,
    };

    const errors = validateResolutionPreconditions(paramsWithBlocking);
    expect(errors.status).toContain("2 action(s) corrective(s) bloquante(s)");
  });

  describe("computeDefaultReviewDate (+30 jours après la date métier)", () => {
    const TZ = "America/Toronto";

    it("computes exactly 30 days ahead from a reference date", () => {
      const ref = new Date("2026-08-01T12:00:00Z");
      expect(computeDefaultReviewDate(TZ, ref)).toBe("2026-08-31");
    });

    it("handles month rollover properly", () => {
      const ref = new Date("2026-01-15T05:00:00Z");
      expect(computeDefaultReviewDate(TZ, ref)).toBe("2026-02-14");
    });

    /**
     * Régression : 21 h à Montréal = 01 h UTC le lendemain. Partir de l'UTC
     * daterait la révision d'un jour de trop (08_DEFINITIONS_ANALYTIQUES.md
     * — « date métier courante »).
     */
    it("uses the business day, not the UTC day, late in the evening", () => {
      const lateEveningInToronto = new Date("2026-08-25T01:30:00Z"); // 24 août 21 h 30 à Montréal
      expect(computeDefaultReviewDate(TZ, lateEveningInToronto)).toBe("2026-09-23");
    });

    /**
     * Régression : le 8 mars 2026 le Québec passe à l'heure avancée. Une
     * addition en millisecondes (+30 × 86 400 000) reculerait d'un jour.
     */
    it("stays on calendar days across a daylight saving transition", () => {
      const beforeDstChange = new Date("2026-03-01T17:00:00Z"); // 1er mars, midi à Montréal
      expect(computeDefaultReviewDate(TZ, beforeDstChange)).toBe("2026-03-31");
    });
  });
});
