import { expect, test } from "@playwright/test";

/**
 * Parcours de bout en bout sur le serveur de développement.
 *
 * Ces tests n'étaient pas écrivables auparavant : sans l'en-tête d'identité de
 * développement, `/api/me` répondait 401 et l'application restait bloquée sur
 * l'écran « Authentification requise ». Le client d'API le pose désormais, ce
 * qui rend le parcours réel observable en local (QA-04 pour sa partie
 * vérifiable sans staging).
 *
 * Prérequis : base D1 locale amorcée (`npm run db:reset:local`).
 */

test("application shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Registre des erreurs/i);
  await expect(page.getByRole("heading", { name: /Registre des erreurs/ })).toBeVisible();
});

test("the root redirects to the operational home", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/accueil$/);
  await expect(page.getByTestId("home-view")).toBeVisible();
  await expect(page.getByTestId("home-my-issues")).toBeVisible();
  await expect(page.getByTestId("home-urgent")).toBeVisible();
  await expect(page.getByTestId("home-waiting")).toBeVisible();
  await expect(page.getByTestId("home-reviews")).toBeVisible();
});

test("the primary navigation exposes the main destinations", async ({ page }) => {
  await page.goto("/registre");

  await expect(page.getByTestId("tab-new")).toBeVisible();
  await expect(page.getByTestId("tab-list")).toBeVisible();
  await expect(page.getByTestId("tab-home")).toBeVisible();
  await expect(page.getByTestId("tab-analytics")).toBeVisible();

  // Ce sont de vrais liens : ils portent une URL et s'ouvrent dans un onglet.
  await expect(page.getByTestId("tab-list")).toHaveAttribute("href", "/registre");
});

test("a manager attributes an error to an employee and sees the saved name", async ({ page }) => {
  const managerHeaders = { "X-Dev-User-Email": "manager@example.test" };
  const metaResponse = await page.request.get("/api/meta", { headers: managerHeaders });
  expect(metaResponse.ok()).toBeTruthy();
  const metaBody = await metaResponse.json();
  const locationId = metaBody.data.locations[0].id;
  const categoryId = metaBody.data.categories[0].id;
  const impactTypeId = metaBody.data.impactTypes[0].id;
  const employee = metaBody.data.users.find((user: any) => user.role === "employee" && user.active);
  expect(employee).toBeTruthy();

  const createResponse = await page.request.post("/api/issues", {
    headers: { ...managerHeaders, "Content-Type": "application/json" },
    data: {
      occurredOn: "2026-08-25",
      locationId,
      categoryId,
      description: "Dossier Playwright pour vérifier l'attribution à un employé.",
      priority: "normal",
      impacts: [{ impactTypeId, details: null }],
    },
  });
  expect(createResponse.status()).toBe(201);
  const created = await createResponse.json();

  await page.addInitScript(() => {
    localStorage.setItem("registre.devUserEmail", "manager@example.test");
  });
  await page.goto(`/dossiers/${created.data.publicId}`);
  await page.getByTestId("btn-open-edit-issue").click();

  const employeeSelect = page.getByTestId("select-edit-error-actor");
  await expect(employeeSelect).toBeVisible();
  await employeeSelect.selectOption(String(employee.id));
  await page.getByTestId("btn-save-issue").click();

  await expect(page.getByTestId("modal-edit-issue")).toBeHidden();
  await expect(page.getByTestId("issue-error-actor")).toContainText(employee.displayName);
});

/**
 * S39 : « Registre conserve filtres au retour ».
 *
 * Les filtres vivent dans l'URL, donc un rechargement complet — le cas le plus
 * dur, puisqu'il détruit tout état mémoire — doit les restituer.
 */
test("registry filters survive a full page reload", async ({ page }) => {
  await page.goto("/registre?q=palette&status=new&priority=normal");

  await expect(page.getByTestId("search-input")).toHaveValue("palette");

  await page.reload();
  await expect(page.getByTestId("search-input")).toHaveValue("palette");
  await expect(page).toHaveURL(/q=palette/);
});

/**
 * §Deep links : « une URL dossier doit ouvrir directement le détail après
 * authentification ».
 */
test("a file opens straight from its own URL", async ({ page }) => {
  await page.goto("/dossiers/INC-000001");

  await expect(page.getByTestId("issue-detail-container")).toBeVisible();
  await expect(page.getByText("INC-000001").first()).toBeVisible();
});

/**
 * L'aller-retour depuis un dossier restitue la liste telle qu'elle était,
 * filtres compris — le scénario que S39 décrit littéralement.
 */
test("returning from a file restores the filtered registry", async ({ page }) => {
  await page.goto("/registre?status=new");

  const firstCard = page.locator('[data-testid^="issue-card-"]').first();
  await expect(firstCard).toBeVisible();
  await firstCard.click();

  await expect(page).toHaveURL(/\/dossiers\//);
  await page.getByTestId("btn-back-to-list").click();

  await expect(page).toHaveURL(/\/registre\?status=new/);
});

/** Une URL inconnue ramène au Registre plutôt que sur une page blanche. */
test("an unknown URL falls back to the registry", async ({ page }) => {
  await page.goto("/une-page-qui-nexiste-pas");
  await expect(page).toHaveURL(/\/registre$/);
});
