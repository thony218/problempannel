import { expect, test, type Page } from "@playwright/test";

/**
 * QA-04 — parcours de bout en bout complet.
 *
 * `05_qualite_exploitation/02_PLAN_TESTS.md` §« E2E principal » décrit une
 * seule chaîne, du signalement à la réouverture :
 *
 *   création → prise en charge → attente → reprise → action corrective
 *   → résolution pending → efficacité → réouverture
 *
 * Les tests de bout en bout existants couvraient la navigation, les filtres et
 * l'attribution — chacun sur un dossier neuf. Aucun ne suivait un dossier à
 * travers son cycle de vie, alors que c'est là que vivent les règles les plus
 * coûteuses à casser : préconditions de transition, action bloquante, motif de
 * réouverture, conservation de l'attente précédente dans l'historique.
 *
 * Le parcours est délibérément joué **dans l'interface** et non par appels
 * d'API : c'est la seule façon de démontrer qu'un employé et un gestionnaire
 * peuvent réellement mener un dossier de bout en bout. Écrire ce test a
 * d'ailleurs révélé qu'ils ne le pouvaient pas — l'écran de modification
 * n'offrait aucun champ de sous-catégorie au gestionnaire, alors que toute
 * sortie de `new` en exige une.
 *
 * Prérequis : base D1 locale amorcée (`npm run db:reset:local`).
 */

const EMPLOYEE = "employee@example.test";
const MANAGER = "manager@example.test";

/** Bascule l'identité de développement puis recharge la page. */
async function actAs(page: Page, email: string): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("registre.devUserEmail", value), email);
  await page.reload();
}

/** Ouvre la modale de modification et attend qu'elle soit prête. */
async function openEditModal(page: Page): Promise<void> {
  await page.getByTestId("btn-open-edit-issue").click();
  await expect(page.getByTestId("modal-edit-issue")).toBeVisible();
}

/** Enregistre la modification et attend la fermeture de la modale. */
async function saveEditModal(page: Page): Promise<void> {
  await page.getByTestId("btn-save-issue").click();
  await expect(page.getByTestId("modal-edit-issue")).toBeHidden();
}

/** Statut courant affiché sur l'écran Détail. */
async function expectStatus(page: Page, status: string): Promise<void> {
  await expect(page.getByTestId("issue-status-badge")).toHaveAttribute("data-status", status);
}

test.describe("QA-04 — cycle de vie complet d'un dossier", () => {
  // Le parcours enchaîne huit étapes, chacune avec un aller-retour serveur.
  test.setTimeout(120_000);

  test("carries one file from declaration through reopening", async ({ page }) => {
    // ---------------------------------------------------------------
    // 1. Création — un employé déclare un incident depuis l'écran Nouveau.
    // ---------------------------------------------------------------
    // Pas d'`addInitScript` ici : il se rejoue à **chaque** navigation, donc
    // il réécraserait l'identité à chaque `actAs`. `employee@example.test` est
    // déjà l'identité de développement par défaut (`src/shared/apiClient.ts`).
    await page.goto("/nouveau");
    await page.evaluate((email) => localStorage.removeItem("registre.devUserEmail") ?? email, EMPLOYEE);
    await page.reload();
    await expect(page.getByTestId("create-issue-form")).toBeVisible();

    // Le formulaire propose déjà la date du jour et la succursale par défaut.
    await page.selectOption("#categoryId", { index: 1 });
    await page
      .locator("#description")
      .fill("Commande expédiée avec le mauvais produit, constatée à la réception par le client.");

    // Au moins un impact est obligatoire.
    await page.locator('input[type="checkbox"]').first().check();

    await page.getByTestId("btn-submit-issue").click();

    const successCard = page.getByTestId("creation-success-card");
    await expect(successCard).toBeVisible();
    const publicId = (await successCard.textContent())?.match(/INC-\d{6}/)?.[0];
    expect(publicId, "le numéro de dossier doit être annoncé à la création").toBeTruthy();

    await page.getByTestId("btn-open-created-issue").click();
    await expect(page.getByTestId("issue-detail-container")).toBeVisible();
    await expectStatus(page, "new");

    // ---------------------------------------------------------------
    // 2. Prise en charge — le gestionnaire trie et passe le dossier en cours.
    // ---------------------------------------------------------------
    await actAs(page, MANAGER);
    await expect(page.getByTestId("issue-detail-container")).toBeVisible();

    await openEditModal(page);
    // Sortie de `new` : la sous-catégorie est une précondition
    // (01_produit/03_MATRICE_TRANSITIONS.md).
    await page.getByTestId("select-edit-subcategory").selectOption({ index: 1 });
    await page.getByTestId("select-edit-owner").selectOption({ index: 1 });
    await page.getByTestId("select-edit-status").selectOption("inProgress");
    await saveEditModal(page);

    await expectStatus(page, "inProgress");

    // ---------------------------------------------------------------
    // 3. Attente — le dossier dépend d'un fournisseur.
    // ---------------------------------------------------------------
    await openEditModal(page);
    await page.getByTestId("select-edit-status").selectOption("waiting");
    await page.getByTestId("select-edit-waiting-type").selectOption("supplier");
    await page.getByTestId("input-edit-waiting-label").fill("Fournisseur Transport Nord");
    await saveEditModal(page);

    await expectStatus(page, "waiting");

    // ---------------------------------------------------------------
    // 4. Reprise — retour en cours; l'attente précédente doit rester tracée.
    // ---------------------------------------------------------------
    await openEditModal(page);
    await page.getByTestId("select-edit-status").selectOption("inProgress");
    await saveEditModal(page);

    await expectStatus(page, "inProgress");

    // Les colonnes d'attente sont purgées : sans trace dans l'historique, la
    // raison de la stagnation disparaîtrait avec elles.
    await page.getByTestId("tab-history").click();
    await expect(page.getByTestId("history-timeline-section")).toContainText("Fournisseur Transport Nord");

    // ---------------------------------------------------------------
    // 5. Action corrective bloquante.
    // ---------------------------------------------------------------
    const meResponse = await page.request.get("/api/me", { headers: { "X-Dev-User-Email": MANAGER } });
    const managerId = (await meResponse.json()).data.id;

    await page.getByTestId("tab-actions").click();
    await expect(page.getByTestId("corrective-actions-section")).toBeVisible();
    await page.getByTestId("btn-open-create-action").click();

    await page.getByTestId("input-create-action-title").fill("Revoir la procédure de préparation de commande");
    await page.locator("#act-owner").fill(String(managerId));
    await page.getByTestId("input-create-action-due").fill("2026-12-31");
    await page.locator('input[type="checkbox"]').last().check(); // bloque la clôture
    await page.getByTestId("btn-submit-create-action").click();

    await expect(page.getByTestId("modal-create-action")).toBeHidden();
    const actionCard = page.locator('[data-testid^="action-card-"]').first();
    await expect(actionCard).toBeVisible();
    await expect(actionCard).toContainText("Bloque la clôture");

    // ---------------------------------------------------------------
    // 6. Résolution refusée tant que l'action bloquante est ouverte (S11).
    // ---------------------------------------------------------------
    await openEditModal(page);
    await page.getByTestId("select-edit-status").selectOption("resolved");
    await page.getByTestId("select-edit-cause-status").selectOption("known");
    await page.getByTestId("textarea-edit-cause-summary").fill("Étiquette de préparation mal lue au picking.");
    await page.getByTestId("select-edit-permanent-type").selectOption("procedureUpdate");
    await page.getByTestId("textarea-edit-permanent-summary").fill("Double lecture du code-barres à la préparation.");
    await page.getByTestId("textarea-edit-final-result").fill("Produit repris et remplacé chez le client.");
    await page.getByTestId("textarea-edit-prevention-learning").fill("Former l'équipe d'entrepôt à la double lecture.");
    await page.getByTestId("btn-save-issue").click();

    // Le message doit nommer la cause : une résolution refusée pour une autre
    // raison (champ manquant, conflit de version) rendrait ce test vert sans
    // rien prouver de la règle « aucune action bloquante ouverte ».
    await expect(page.getByTestId("edit-form-error")).toContainText("bloquante");
    await expect(page.getByTestId("modal-edit-issue")).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).first().click();
    await expectStatus(page, "inProgress");

    // ---------------------------------------------------------------
    // 7. Action terminée, puis résolution avec efficacité `pending`.
    // ---------------------------------------------------------------
    await page.getByTestId("tab-actions").click();
    const actionId = (await actionCard.getAttribute("data-testid"))?.replace("action-card-", "");
    await page.getByTestId(`btn-edit-action-${actionId}`).click();
    await page.getByTestId("select-edit-action-status").selectOption("done");
    await page.getByTestId("input-edit-action-result").fill("Procédure mise à jour et diffusée.");
    await page.getByTestId("btn-submit-edit-action").click();
    await expect(page.getByTestId("modal-edit-action")).toBeHidden();

    await openEditModal(page);
    await page.getByTestId("select-edit-status").selectOption("resolved");
    await page.getByTestId("select-edit-cause-status").selectOption("known");
    await page.getByTestId("textarea-edit-cause-summary").fill("Étiquette de préparation mal lue au picking.");
    await page.getByTestId("select-edit-permanent-type").selectOption("procedureUpdate");
    await page.getByTestId("textarea-edit-permanent-summary").fill("Double lecture du code-barres à la préparation.");
    await page.getByTestId("textarea-edit-final-result").fill("Produit repris et remplacé chez le client.");
    await page.getByTestId("textarea-edit-prevention-learning").fill("Former l'équipe d'entrepôt à la double lecture.");
    await page.getByTestId("select-edit-effectiveness-status").selectOption("pending");
    await saveEditModal(page);

    await expectStatus(page, "resolved");

    // ---------------------------------------------------------------
    // 8. Évaluation d'efficacité.
    // ---------------------------------------------------------------
    await openEditModal(page);
    await page.getByTestId("select-edit-effectiveness-status").selectOption("effective");
    await saveEditModal(page);

    const detailAfterReview = await page.request.get(`/api/issues/${publicId}`, {
      headers: { "X-Dev-User-Email": MANAGER },
    });
    expect((await detailAfterReview.json()).data.issue.effectivenessStatus).toBe("effective");

    // ---------------------------------------------------------------
    // 9. Réouverture — le motif est obligatoire (FLOW-04).
    // ---------------------------------------------------------------
    await openEditModal(page);
    await page.getByTestId("select-edit-status").selectOption("inProgress");
    await expect(page.getByTestId("input-reopen-reason")).toBeVisible();
    await page.getByTestId("input-reopen-reason").fill("Le même produit a été mal expédié une seconde fois.");
    await saveEditModal(page);

    await expectStatus(page, "inProgress");

    // La réouverture doit laisser une trace, et `resolvedAt` repasser à null.
    const reopened = await page.request.get(`/api/issues/${publicId}`, {
      headers: { "X-Dev-User-Email": MANAGER },
    });
    const reopenedBody = await reopened.json();
    expect(reopenedBody.data.issue.status).toBe("inProgress");
    expect(reopenedBody.data.issue.resolvedAt).toBeNull();

    const history = await page.request.get(`/api/issues/${publicId}/history`, {
      headers: { "X-Dev-User-Email": MANAGER },
    });
    const events = (await history.json()).data.items.map((event: { eventType: string }) => event.eventType);
    expect(events).toContain("issue_created");
    expect(events).toContain("issue_reopened");
  });
});
