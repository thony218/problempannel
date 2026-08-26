import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md` §Accessibilité : « WCAG 2.1
 * AA visé pour parcours principaux ». L'exigence est gelée depuis le
 * 2026-08-24 et n'avait jamais été mesurée — « visé » ne se vérifie pas.
 *
 * Ce que cet audit prouve et ne prouve pas : axe-core détecte de façon fiable
 * les manquements mécaniques (contraste, noms accessibles, rôles, structure,
 * étiquettes de formulaire). Il ne juge pas l'ordre de tabulation, la
 * pertinence d'un texte alternatif ni la compréhension au lecteur d'écran.
 * Un audit vert ici est nécessaire, jamais suffisant : il élimine la classe
 * de défauts qu'une machine sait voir, et laisse le reste à une revue humaine.
 *
 * **Chaque écran est auditée peuplée, sous une identité d'administrateur.**
 * Une première version de ce fichier auditait les pages sans identité et sans
 * base amorcée : les six écrans passaient, mais ils étaient vides. Un audit
 * d'accessibilité sur une page sans contenu ne mesure rien — d'où l'assertion
 * de contenu qui précède chaque analyse.
 *
 * Prérequis : base D1 locale amorcée (`npm run db:reset:local`), comme pour
 * `lifecycle.spec.ts`.
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const ADMIN = "admin@example.test";

/**
 * Écrans du parcours principal, avec le repère qui prouve qu'ils sont peuplés.
 * Le repère est du contenu réel, jamais une coquille de mise en page.
 */
const SCREENS: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    name: "Accueil",
    path: "/accueil",
    ready: async (page) => await expect(page.getByRole("heading", { name: /Bonjour/ })).toBeVisible(),
  },
  {
    name: "Registre",
    path: "/registre",
    ready: async (page) => await expect(page.getByText(/INC-\d{6}/).first()).toBeVisible(),
  },
  {
    name: "Nouveau dossier",
    path: "/nouveau",
    ready: async (page) => await expect(page.getByTestId("create-issue-form")).toBeVisible(),
  },
  {
    name: "Détail",
    path: "/dossiers/INC-000001",
    ready: async (page) => await expect(page.getByTestId("issue-detail-container")).toBeVisible(),
  },
  {
    name: "Analyse",
    path: "/analyse",
    ready: async (page) => await expect(page.getByTestId("analytics-view")).toBeVisible(),
  },
  {
    name: "Administration",
    path: "/administration",
    ready: async (page) => await expect(page.getByTestId("admin-view")).toBeVisible(),
  },
];

/** Rend les violations lisibles dans le message d'échec, sans dump JSON. */
function describeViolations(
  violations: { id: string; impact?: string | null; help: string; nodes: { target: unknown[] }[] }[]
): string {
  return violations
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      return `  [${violation.impact ?? "n/a"}] ${violation.id} — ${violation.help}\n    sur : ${targets}`;
    })
    .join("\n");
}

/** Pose l'identité de développement avant le premier rendu de l'application. */
async function signIn(page: Page, email: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem("registre.devUserEmail", value);
  }, email);
}

/**
 * Amorce un dossier avant l'audit.
 *
 * `seed/dev.sql` ne crée aucun dossier : sans cette étape, le Registre est
 * vide et l'écran Détail introuvable. Les identifiants de référentiels sont
 * lus depuis `/api/meta` plutôt que codés en dur, pour que le test survive à
 * un changement de seed.
 */
async function seedOneIssue(request: APIRequestContext): Promise<void> {
  const headers = { "X-Dev-User-Email": ADMIN, "Content-Type": "application/json" };
  // Les réponses sont enveloppées : `{ ok, data }` (`okBody`).
  const existing = (await (await request.get("/api/issues", { headers })).json()) as any;
  if (existing.data?.items?.length > 0) return;

  const meta = ((await (await request.get("/api/meta", { headers })).json()) as any).data;
  const response = await request.post("/api/issues", {
    headers,
    data: {
      occurredOn: new Date().toISOString().slice(0, 10),
      locationId: meta.locations[0].id,
      categoryId: meta.categories[0].id,
      description: "Dossier d'audit d'accessibilité — contenu sans importance métier.",
      priority: "normal",
      impacts: [{ impactTypeId: meta.impactTypes[0].id }],
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

test.describe("Accessibilité WCAG 2.1 AA des parcours principaux", () => {
  test.beforeAll(async ({ request }) => {
    await seedOneIssue(request);
  });

  for (const screen of SCREENS) {
    test(`${screen.name} ne présente aucune violation détectable`, async ({ page }) => {
      await signIn(page, ADMIN);
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
      await screen.ready(page);

      const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

      expect(
        results.violations,
        `${screen.name} — ${results.violations.length} violation(s) :\n${describeViolations(results.violations)}`
      ).toHaveLength(0);
    });
  }

  test("La modale de modification reste conforme une fois ouverte", async ({ page }) => {
    // Une modale est le moment où l'accessibilité se joue vraiment : piège de
    // focus, nom accessible, étiquettes des champs. L'auditer fermée ne
    // prouverait rien, puisqu'elle n'est pas dans le DOM.
    await signIn(page, ADMIN);
    await page.goto("/dossiers/INC-000001");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("btn-open-edit-issue").click();
    await expect(page.getByTestId("modal-edit-issue")).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

    expect(
      results.violations,
      `Modale de modification — ${results.violations.length} violation(s) :\n${describeViolations(results.violations)}`
    ).toHaveLength(0);
  });
});
