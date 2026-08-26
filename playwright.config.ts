import { defineConfig, devices } from "@playwright/test";

/**
 * Couverture navigateurs.
 *
 * `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md` §Navigateurs exige « actuel
 * + précédent : Chrome, Edge, Safari, Firefox; Safari iOS et Chrome Android ».
 * La configuration ne couvrait que Chromium et deux profils mobiles : Firefox
 * et Safari bureau n'avaient donc jamais été exercés, et personne ne savait ce
 * qu'un gestionnaire y voyait.
 *
 * Edge partage le moteur de rendu de Chrome; le projet `chromium` couvre donc
 * son rendu. Ce qu'il ne couvre pas, c'est le binaire Edge lui-même. Le projet
 * `edge` ci-dessous le teste pour de vrai, mais reste **opt-in** : Edge n'est
 * pas installé sur les postes de développement macOS du projet, et un projet
 * qui échoue faute de binaire rendrait la suite rouge en permanence — ce qui
 * revient à ne plus la lire. Activer avec `PLAYWRIGHT_EDGE=1`, après
 * `npx playwright install msedge`.
 */
const edgeProjects =
  process.env.PLAYWRIGHT_EDGE === "1"
    ? [{ name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } }]
    : [];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "line" : "html",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    // WebKit est le moteur de Safari : c'est la seule façon de tester Safari
    // bureau sur une machine qui ne peut pas piloter Safari lui-même.
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
    ...edgeProjects,
  ],
});
