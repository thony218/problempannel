import { expect, test } from "@playwright/test";

test("application shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Registre des erreurs/i);
  await expect(page.getByRole("heading", { name: "Registre des erreurs" })).toBeVisible();
});
