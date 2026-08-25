/**
 * Source unique de la configuration d'exécution issue des variables Worker
 * (`wrangler.jsonc` -> `vars`) et des dates « métier ».
 *
 * Motivation : `/api/meta` publie ces valeurs au client (limites de fichiers,
 * fuseau horaire d'affaires). Si un service les redéclare en dur, le serveur
 * applique une règle différente de celle annoncée au client dès qu'un
 * opérateur change une variable. Tout consommateur doit passer par ici.
 */

export interface AppConfig {
  businessTimeZone: string;
  maxAttachmentBytes: number;
  maxAttachmentsPerIssue: number;
  recurringWindowDays: number;
  recurringMinCount: number;
}

/** Valeurs de repli si une variable est absente ou non numérique. */
const DEFAULTS = {
  businessTimeZone: "America/Toronto",
  maxAttachmentBytes: 10 * 1024 * 1024,
  maxAttachmentsPerIssue: 10,
  recurringWindowDays: 90,
  recurringMinCount: 3,
} as const;

function positiveIntOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function appConfigFromEnv(env: Env): AppConfig {
  return {
    businessTimeZone: env.BUSINESS_TIME_ZONE || DEFAULTS.businessTimeZone,
    maxAttachmentBytes: positiveIntOr(env.MAX_ATTACHMENT_BYTES, DEFAULTS.maxAttachmentBytes),
    maxAttachmentsPerIssue: positiveIntOr(env.MAX_ATTACHMENTS_PER_ISSUE, DEFAULTS.maxAttachmentsPerIssue),
    recurringWindowDays: positiveIntOr(env.RECURRING_WINDOW_DAYS, DEFAULTS.recurringWindowDays),
    recurringMinCount: positiveIntOr(env.RECURRING_MIN_COUNT, DEFAULTS.recurringMinCount),
  };
}

/**
 * Les helpers de date métier vivent dans `src/shared/businessDate.ts`, seul
 * emplacement importable à la fois par le Worker et par l'interface : la règle
 * « date métier » est ainsi définie une seule fois pour les deux côtés.
 */
export { addCalendarDays, businessToday } from "../../src/shared/businessDate";
