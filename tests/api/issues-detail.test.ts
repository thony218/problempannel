import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const DEV_HEADER = { "X-Dev-User-Email": "creator@example.test", "Content-Type": "application/json" };

async function get(path: string, headers: HeadersInit = DEV_HEADER) {
  return app.request(`http://local/api${path}`, { method: "GET", headers }, env);
}

async function post(path: string, body: unknown) {
  return app.request(`http://local/api${path}`, { method: "POST", headers: DEV_HEADER, body: JSON.stringify(body) }, env);
}

let userId: number;
let locationId: number;
let categoryId: number;
let impactTimeLostId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM corrective_actions"),
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);

  userId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'Créateur', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  locationId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('TEST', 'Succursale test') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  impactTimeLostId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
});

async function createIssue() {
  const res = await post("/issues", {
    occurredOn: "2026-08-20",
    locationId,
    categoryId,
    description: "Un incident test de longueur suffisante.",
    priority: "normal",
    impacts: [{ impactTypeId: impactTimeLostId, details: null }],
  });
  const body = (await res.json()) as any;
  if (res.status !== 201) {
    throw new Error(`createIssue failed: ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data as { publicId: string; rowVersion: number };
}

describe("GET /api/issues/:publicId", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await get("/issues/INC-000001", {} as Record<string, string>);
    expect(res.status).toBe(401);
  });

  it("returns 404 for a well-formed but unknown publicId", async () => {
    const res = await get("/issues/INC-999999");
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a malformed publicId", async () => {
    const res = await get("/issues/not-a-valid-id");
    expect(res.status).toBe(404);
  });

  it("returns the issue detail with impacts, ETag and empty correctiveActions", async () => {
    const created = await createIssue();
    const issueId = Number(created.publicId.replace("INC-", ""));

    const res = await get(`/issues/${created.publicId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe(`issue-${issueId}-v${created.rowVersion}`);

    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.data.issue.publicId).toBe(created.publicId);
    expect(body.data.impacts).toHaveLength(1);
    expect(body.data.impacts[0]).toMatchObject({ impactTypeId: impactTimeLostId, details: null });
    expect(body.data.correctiveActions).toEqual([]);
  });

  it("includes corrective actions attached to the issue", async () => {
    const created = await createIssue();
    const issueId = Number(created.publicId.replace("INC-", ""));

    await env.DB.prepare(
      `INSERT INTO corrective_actions (issue_id, title, owner_user_id, due_date, status, blocks_issue_closure)
       VALUES (?, 'Corriger la procédure', ?, '2026-09-01', 'todo', 1)`
    )
      .bind(issueId, userId)
      .run();

    const res = await get(`/issues/${created.publicId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.correctiveActions).toHaveLength(1);
    expect(body.data.correctiveActions[0]).toMatchObject({
      issuePublicId: created.publicId,
      title: "Corriger la procédure",
      ownerUserId: userId,
      status: "todo",
      blocksIssueClosure: true,
    });
  });
});
