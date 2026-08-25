/**
 * Dates « métier », partagées par le Worker et l'interface.
 *
 * `01_produit/08_DEFINITIONS_ANALYTIQUES.md` raisonne en *date métier
 * courante*, pas en date UTC. Le fuseau est une variable Worker
 * (`BUSINESS_TIME_ZONE`) republiée au client dans `/api/meta` →
 * `config.businessTimeZone`.
 *
 * L'écart n'est pas théorique : à Montréal (UTC-4/-5), `new Date()
 * .toISOString()` bascule au lendemain dès 19 h ou 20 h locale. Un
 * formulaire pré-rempli avec cette date propose une date de survenance dans
 * le futur, et un filtre « en retard » déclenche plusieurs heures trop tôt.
 *
 * Ce module vit dans `src/shared` parce qu'il est le seul endroit importable
 * à la fois par `worker/` et par `src/` (même mécanique que
 * `api-types.generated.ts`) : la règle est donc définie une seule fois.
 */

/** Date métier courante au format AAAA-MM-JJ (`en-CA` produit nativement ce format). */
export function businessToday(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Fuseau inconnu (variable mal saisie) : ne pas faire échouer l'appelant.
    return now.toISOString().slice(0, 10);
  }
}

/**
 * Ajoute `days` jours calendaires à une date AAAA-MM-JJ.
 *
 * Arithmétique calendaire via `Date.UTC`, et non « +N × 86 400 000 ms » sur un
 * instant : un passage à l'heure avancée dans l'intervalle ne peut pas décaler
 * le résultat d'un jour.
 */
export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}
