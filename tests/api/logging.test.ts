import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../../worker/index";

/**
 * OPS-03 — journalisation (02_contrats/04_SECURITE_AUTH.md §Logs).
 *
 * À logger : requestId, route, statut HTTP, durée, code d'erreur.
 * À ne pas logger : JWT, cookies, secrets, fichiers, corps complet des
 * descriptions et commentaires.
 *
 * Ces tests portent autant sur ce que la ligne contient que sur ce qu'elle ne
 * doit **jamais** contenir : c'est la moitié qui se dégrade silencieusement
 * quand on ajoute un champ « utile » au log.
 */

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test", "Content-Type": "application/json" };

let locationId: number;
let categoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES ('emp@example.test', 'Employé', 'employee', 1)"
  ).run();
  locationId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('MTL', 'Montréal') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('recv', 'Réception') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
  impactId = (
    await env.DB.prepare("INSERT INTO impact_types (code, label) VALUES ('t', 'Temps perdu') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
});

async function captureLogs(run: () => unknown): Promise<string[]> {
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await run();
    return spy.mock.calls.map((call) => String(call[0]));
  } finally {
    spy.mockRestore();
  }
}

describe("OPS-03 : journalisation des requêtes", () => {
  it("logs one line per request with the fields the contract requires", async () => {
    const lines = await captureLogs(() =>
      app.request("http://local/api/meta", { headers: EMPLOYEE_HEADER }, env)
    );

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);

    expect(entry.event).toBe("request");
    expect(entry.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(entry.route).toBe("/api/meta");
    expect(entry.status).toBe(200);
    expect(typeof entry.durationMs).toBe("number");
    expect(entry.userId).toBeGreaterThan(0);
  });

  it("records the business error code on a rejected request", async () => {
    const lines = await captureLogs(() =>
      app.request("http://local/api/meta", { headers: { "X-Dev-User-Email": "inconnu@example.test" } }, env)
    );

    const entry = JSON.parse(lines[0]);
    expect(entry.status).toBe(401);
    expect(entry.errorCode).toBe("UNAUTHORIZED");
    expect(entry.userId).toBeNull();
  });

  /**
   * Le motif de route est journalisé, pas l'URL : celle-ci porte le numéro de
   * dossier, et le paramètre de recherche `q` contient du texte saisi par
   * l'utilisateur.
   */
  it("never leaks the search terms or the identifying URL", async () => {
    const lines = await captureLogs(() =>
      app.request(
        "http://local/api/issues?q=" + encodeURIComponent("nom du client"),
        { headers: EMPLOYEE_HEADER },
        env
      )
    );

    const entry = JSON.parse(lines[0]);
    expect(entry.route).toBe("/api/issues");
    expect(lines[0]).not.toContain("nom du client");
    expect(lines[0]).not.toContain("q=");
  });

  it("never leaks the identity header nor the description body", async () => {
    const lines = await captureLogs(() =>
      app.request(
        "http://local/api/issues",
        {
          method: "POST",
          headers: EMPLOYEE_HEADER,
          body: JSON.stringify({
            occurredOn: "2026-08-20",
            locationId,
            categoryId,
            description: "Le client Jean Tremblay a signalé une erreur de facturation.",
            priority: "normal",
            impacts: [{ impactTypeId: impactId }],
          }),
        },
        env
      )
    );

    const joined = lines.join("\n");
    expect(joined).not.toContain("Jean Tremblay");
    expect(joined).not.toContain("emp@example.test");
    expect(joined).not.toContain("X-Dev-User-Email");
    // L'utilisateur est identifié par son id interne, jamais par son courriel.
    expect(JSON.parse(lines[0]).userId).toBeGreaterThan(0);
  });
});
