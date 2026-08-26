/**
 * Mesure de latence et calcul de percentile.
 *
 * `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md` exprime ses budgets en p95,
 * pas en moyenne : une moyenne masque exactement le type de dérive qui gêne un
 * utilisateur (quelques requêtes très lentes noyées dans beaucoup de rapides).
 * Le percentile est calculé par rang le plus proche, sans interpolation, pour
 * qu'une valeur rapportée soit toujours une mesure réellement observée.
 */

export interface LatencyReport {
  label: string;
  samples: number;
  p50: number;
  p95: number;
  max: number;
}

/** Percentile par rang le plus proche sur une série déjà triée ou non. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error("percentile: série vide");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1];
}

export interface MeasureOptions {
  /** Itérations mesurées. */
  iterations?: number;
  /** Itérations préalables non mesurées (préparation du plan de requête). */
  warmup?: number;
}

/**
 * Exécute `run` plusieurs fois et rapporte la distribution des durées.
 *
 * `run` doit renvoyer le statut HTTP obtenu : une mesure sur une requête qui
 * échoue est un faux succès de performance — un 500 immédiat serait le plus
 * rapide de tous. Un statut inattendu interrompt donc la mesure.
 */
export async function measure(
  label: string,
  run: (iteration: number) => Promise<number>,
  expectedStatus: number,
  options: MeasureOptions = {}
): Promise<LatencyReport> {
  const iterations = options.iterations ?? 20;
  const warmup = options.warmup ?? 3;

  for (let i = 0; i < warmup; i += 1) {
    const status = await run(-1 - i);
    if (status !== expectedStatus) {
      throw new Error(`${label} : statut ${status} pendant la chauffe, ${expectedStatus} attendu`);
    }
  }

  const durations: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    const status = await run(i);
    const elapsed = performance.now() - started;
    if (status !== expectedStatus) {
      throw new Error(`${label} : statut ${status} à l'itération ${i}, ${expectedStatus} attendu`);
    }
    durations.push(elapsed);
  }

  return {
    label,
    samples: durations.length,
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    max: Math.max(...durations),
  };
}

/** Ligne de rapport lisible, imprimée pour laisser une trace de la mesure. */
export function formatReport(report: LatencyReport, budgetMs: number): string {
  const verdict = report.p95 <= budgetMs ? "OK" : "DEPASSE";
  return (
    `[${verdict}] ${report.label} — p50 ${report.p50.toFixed(0)} ms, ` +
    `p95 ${report.p95.toFixed(0)} ms, max ${report.max.toFixed(0)} ms ` +
    `(budget p95 ${budgetMs} ms, ${report.samples} mesures)`
  );
}
