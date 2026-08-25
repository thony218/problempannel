import path from "node:path";
import react from "@vitejs/plugin-react";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * `tests/e2e` appartient à Playwright et ne doit jamais être collecté par
 * Vitest (S49 / V4-E2E-01). L'exclusion est répétée sur chaque projet : un
 * projet ne réutilise pas l'`exclude` de la racine.
 */
const EXCLUDE = [...configDefaults.exclude, "tests/e2e/**"];

/**
 * Deux projets, parce que les deux moitiés du dépôt n'ont pas le même runtime.
 *
 * - `worker` : tests d'API et d'intégration, exécutés dans workerd via le pool
 *   Cloudflare, avec les vraies liaisons D1/R2 et les migrations appliquées.
 * - `app` : tests d'interface, exécutés sous Node. Ils rendent les composants
 *   avec `react-dom/server`, qui ne fonctionne pas dans le pool Workers : le
 *   build CJS de `react-dom` y charge une seconde instance de `react`, le
 *   dispatcher de hooks vaut alors `null` et tout `useState` échoue.
 */
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
                bindings: { TEST_MIGRATIONS: migrations },
              },
            };
          }),
        ],
        test: {
          name: "worker",
          include: ["tests/api/**/*.test.ts", "tests/integration/**/*.test.ts"],
          exclude: EXCLUDE,
          setupFiles: ["./tests/setup.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "app",
          include: ["tests/app/**/*.test.ts", "tests/app/**/*.test.tsx"],
          exclude: EXCLUDE,
          environment: "node",
        },
      },
    ],
  },
});
