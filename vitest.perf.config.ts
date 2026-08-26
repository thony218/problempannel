import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * Configuration dédiée aux mesures de volumétrie (`tests/perf`).
 *
 * Séparée de `vitest.config.ts` à dessein : amorcer 100 000 dossiers puis
 * mesurer chaque endpoint prend plusieurs minutes. Mélangée à la suite
 * unitaire, cette durée s'ajouterait à `npm run verify` et à chaque exécution
 * de CI, pour une information qui n'a pas besoin d'être produite à chaque
 * commit.
 *
 * `tests/e2e` reste exclu ici aussi (S49) : l'exclusion de la racine n'est pas
 * héritée par un projet.
 */
const EXCLUDE = [...configDefaults.exclude, "tests/e2e/**"];

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [
          cloudflareTest(async () => {
            const migrations = await readD1Migrations(path.join(process.cwd(), "migrations"));
            return {
              wrangler: { configPath: "./wrangler.jsonc" },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  // `process.env` n'existe pas dans workerd : le test s'exécute
                  // dans le Worker, pas dans Node. Le volume doit donc traverser
                  // la frontière par une liaison, sans quoi `PERF_ISSUES=2000`
                  // est silencieusement ignoré et la mesure ment sur sa taille.
                  PERF_ISSUES: Number(process.env.PERF_ISSUES ?? 100_000),
                  PERF_ITERATIONS: Number(process.env.PERF_ITERATIONS ?? 20),
                },
              },
            };
          }),
        ],
        test: {
          name: "perf",
          include: ["tests/perf/**/*.test.ts"],
          exclude: EXCLUDE,
          setupFiles: ["./tests/setup.ts"],
          // Une mesure complète dépasse largement le délai par défaut.
          testTimeout: 600_000,
          hookTimeout: 900_000,
        },
      },
    ],
  },
});
