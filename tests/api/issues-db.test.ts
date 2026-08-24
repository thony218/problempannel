import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { findIssueByPublicId } from "../../worker/db/issues";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM categories"),
  ]);
});

async function seedMinimalIssue() {
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'Créateur', 'employee', 1)"
  ).run();
  await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('TEST', 'Succursale test')").run();
  await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes')").run();
  const result = await env.DB.prepare(
    `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority)
     SELECT '2026-08-20', u.id, l.id, c.id, 'Description de test suffisamment longue.', 'normal'
     FROM users u, locations l, categories c
     WHERE u.email = 'creator@example.test' AND l.code = 'TEST' AND c.code = 'sales'
     RETURNING id`
  ).first<{ id: number }>();
  return result!.id;
}

describe("findIssueByPublicId", () => {
  it("returns null for a well-formed but unknown publicId", async () => {
    expect(await findIssueByPublicId(env.DB, "INC-999999")).toBeNull();
  });

  it("returns null for a malformed publicId without querying D1", async () => {
    expect(await findIssueByPublicId(env.DB, "not-an-id")).toBeNull();
  });

  it("finds a real issue and maps it to the API shape", async () => {
    const id = await seedMinimalIssue();
    const issue = await findIssueByPublicId(env.DB, `INC-${String(id).padStart(6, "0")}`);
    expect(issue).not.toBeNull();
    expect(issue?.status).toBe("new");
    expect(issue?.rowVersion).toBe(1);
    expect(issue?.description).toContain("Description");
  });
});
