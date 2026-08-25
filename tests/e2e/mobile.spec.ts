import { expect, test } from "@playwright/test";

/**
 * QA-05 / S42 — « mobile 320 px sans scroll horizontal de tâche ».
 *
 * 320 px est la largeur du plus petit écran encore en service ; l'application
 * est destinée à être remplie debout en succursale, sur téléphone. Un
 * débordement horizontal y rend un formulaire pénible bien avant d'être
 * visible sur un poste de travail.
 */

const WIDTHS = [320, 375, 430];

const SCREENS: { name: string; path: string }[] = [
  { name: "Registre", path: "/registre" },
  { name: "Nouveau dossier", path: "/nouveau" },
  { name: "Détail", path: "/dossiers/INC-000001" },
  { name: "Analyse", path: "/analyse" },
];

for (const width of WIDTHS) {
  for (const screen of SCREENS) {
    test(`${screen.name} n'a pas de débordement horizontal à ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        overflow.scrollWidth,
        `${overflow.scrollWidth}px de contenu pour ${overflow.clientWidth}px de fenêtre`
      ).toBeLessThanOrEqual(overflow.clientWidth);
    });
  }
}
