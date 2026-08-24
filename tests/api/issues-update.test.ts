import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const DEV_HEADER = { "X-Dev-User-Email": "creator@example.test", "Content-Type": "application/json" };

async function get(path: string) {
  return app.request(`http://local/api${path}`, { method: "GET", headers: DEV_HEADER }, env);
}

async function post(path: string, body: unknown) {
  return app.request(`http://local/api${path}`, { method: "POST", headers: DEV_HEADER, body: JSON.stringify(body) }, env);
}

async function patch(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(
    `http://local/api${path}`,
    { method: "PATCH", headers: { ...DEV_HEADER, ...headers }, body: JSON.stringify(body) },
    env
  );
}

let userId: number;
let secondUserId: number;
let locationId: number;
let categoryId: number;
let otherCategoryId: number;
let subcategoryId: number;
let otherSubcategoryId: number;
let impactTimeLostId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM subcategories"),
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
  secondUserId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('second@example.test', 'Deuxième', 'manager', 1) RETURNING id"
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
  otherCategoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('repairs', 'Réparations') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  subcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'pricing_error', 'Erreur de prix') RETURNING id"
    )
      .bind(categoryId)
      .first<{ id: number }>()
  )!.id;
  otherSubcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'delay', 'Retard') RETURNING id"
    )
      .bind(otherCategoryId)
      .first<{ id: number }>()
  )!.id;

  impactTimeLostId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
});

async function createIssue(overrides: Record<string, unknown> = {}) {
  const res = await post("/issues", {
    occurredOn: "2026-08-20",
    locationId,
    categoryId,
    description: "Un incident test de longueur suffisante.",
    priority: "normal",
    impacts: [{ impactTypeId: impactTimeLostId, details: null }],
    ...overrides,
  });
  const body = (await res.json()) as any;
  if (res.status !== 201) {
    throw new Error(`createIssue failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const etag = res.headers.get("ETag") as string;
  return { publicId: body.data.publicId as string, etag };
}

describe("PATCH /api/issues/:publicId", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.request(
      "http://local/api/issues/INC-000001",
      { method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": "issue-1-v1" }, body: "{}" },
      env
    );
    expect(res.status).toBe(401);
  });

  it("rejects a request without If-Match with 428", async () => {
    const { publicId } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "Nouvelle description suffisamment longue." });
    expect(res.status).toBe(428);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  it("returns 404 for a well-formed but unknown publicId", async () => {
    const res = await patch("/issues/INC-999999", { description: "x".repeat(20) }, { "If-Match": "issue-999999-v1" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed publicId", async () => {
    const res = await patch("/issues/not-valid", { description: "x".repeat(20) }, { "If-Match": "irrelevant" });
    expect(res.status).toBe(404);
  });

  it("S16: rejects an empty body (minProperties 1) with 422", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, {}, { "If-Match": etag });
    expect(res.status).toBe(422);
  });

  it("S15: rejects a mismatched If-Match with 409", async () => {
    const { publicId } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "x".repeat(20) }, { "If-Match": "issue-1-v999" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("S15: rejects a stale ETag from before a previous successful PATCH", async () => {
    const { publicId, etag } = await createIssue();
    const first = await patch(`/issues/${publicId}`, { description: "Première mise à jour suffisamment longue." }, { "If-Match": etag });
    expect(first.status).toBe(200);

    const stale = await patch(`/issues/${publicId}`, { description: "Deuxième tentative avec ETag périmé." }, { "If-Match": etag });
    expect(stale.status).toBe(409);
  });

  it("applies a simple field update, bumps rowVersion and returns a fresh ETag", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "Description mise à jour, assez longue." }, { "If-Match": etag });
    expect(res.status).toBe(200);
    const newEtag = res.headers.get("ETag");
    expect(newEtag).not.toBe(etag);

    const body = (await res.json()) as any;
    expect(body.data.issue.description).toBe("Description mise à jour, assez longue.");
    expect(body.data.issue.rowVersion).toBe(2);

    const getRes = await get(`/issues/${publicId}`);
    const getBody = (await getRes.json()) as any;
    expect(getBody.data.issue.description).toBe("Description mise à jour, assez longue.");
  });

  it("replaces impacts entirely when impacts is provided", async () => {
    const { publicId, etag } = await createIssue();
    const otherImpactId = (
      await env.DB.prepare("INSERT INTO impact_types (code, label) VALUES ('reputation', 'Réputation') RETURNING id").first<{
        id: number;
      }>()
    )!.id;

    const res = await patch(
      `/issues/${publicId}`,
      { impacts: [{ impactTypeId: otherImpactId, details: null }] },
      { "If-Match": etag }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.impacts).toHaveLength(1);
    expect(body.data.impacts[0].impactTypeId).toBe(otherImpactId);
  });

  it("rejects leaving 'new' without a subcategory (structural equivalent of S04)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { status: "inProgress" }, { "If-Match": etag });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.subcategoryId).toBeDefined();
  });

  it("accepts leaving 'new' when a subcategory is provided in the same PATCH", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { status: "inProgress", subcategoryId }, { "If-Match": etag });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("inProgress");
  });

  it("rejects status='waiting' without waitingOn", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(`/issues/${publicId}`, { status: "waiting" }, { "If-Match": etag });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.waitingOn).toBeDefined();
  });

  it("accepts status='waiting' with a supplier waitingOn + label (S06-equivalent)", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(
      `/issues/${publicId}`,
      { status: "waiting", waitingOn: { type: "supplier", label: "Fournisseur ABC" } },
      { "If-Match": etag }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("waiting");
    expect(body.data.issue.waitingOn).toEqual({ type: "supplier", userId: null, label: "Fournisseur ABC" });
  });

  it("auto-clears waitingOn when leaving 'waiting' without an explicit waitingOn (S07-equivalent)", async () => {
    const created = await createIssue({ subcategoryId });
    const waitingRes = await patch(
      `/issues/${created.publicId}`,
      { status: "waiting", waitingOn: { type: "customer", label: "Client X" } },
      { "If-Match": created.etag }
    );
    const waitingEtag = waitingRes.headers.get("ETag") as string;

    const res = await patch(`/issues/${created.publicId}`, { status: "inProgress" }, { "If-Match": waitingEtag });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("inProgress");
    expect(body.data.issue.waitingOn).toBeNull();
  });

  it("manages resolvedAt/resolvedByUserId when entering and leaving 'resolved'", async () => {
    const created = await createIssue({ subcategoryId });
    const resolvedRes = await patch(`/issues/${created.publicId}`, { status: "resolved" }, { "If-Match": created.etag });
    expect(resolvedRes.status).toBe(200);
    const resolvedBody = (await resolvedRes.json()) as any;
    expect(resolvedBody.data.issue.resolvedAt).not.toBeNull();
    expect(resolvedBody.data.issue.resolvedByUserId).toBe(userId);

    const reopenRes = await patch(
      `/issues/${created.publicId}`,
      { status: "inProgress" },
      { "If-Match": resolvedRes.headers.get("ETag") as string }
    );
    expect(reopenRes.status).toBe(200);
    const reopenBody = (await reopenRes.json()) as any;
    expect(reopenBody.data.issue.resolvedAt).toBeNull();
    expect(reopenBody.data.issue.resolvedByUserId).toBeNull();
  });

  it("rejects a subcategory that does not belong to the (possibly unchanged) category", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(`/issues/${publicId}`, { categoryId: otherCategoryId }, { "If-Match": etag });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.subcategoryId).toBeDefined();
  });

  it("accepts changing category and subcategory together when they match", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(
      `/issues/${publicId}`,
      { categoryId: otherCategoryId, subcategoryId: otherSubcategoryId },
      { "If-Match": etag }
    );
    expect(res.status).toBe(200);
  });

  it("rejects an inactive/unknown ownerUserId", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { ownerUserId: 999999 }, { "If-Match": etag });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.ownerUserId).toBeDefined();
  });

  it("accepts a valid ownerUserId", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { ownerUserId: secondUserId }, { "If-Match": etag });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.ownerUserId).toBe(secondUserId);
  });

  it("rejects an unknown field (additionalProperties: false)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { notAField: true }, { "If-Match": etag });
    expect(res.status).toBe(422);
  });

  it("records a privacy-safe issue_updated history event without free-text values", async () => {
    const { publicId, etag } = await createIssue();
    await patch(`/issues/${publicId}`, { description: "Texte confidentiel à ne jamais journaliser." }, { "If-Match": etag });

    const rows = await env.DB.prepare(
      "SELECT event_type, payload_json FROM issue_history WHERE event_type = 'issue_updated'"
    ).all<{ event_type: string; payload_json: string }>();
    expect(rows.results).toHaveLength(1);
    const payload = JSON.parse(rows.results[0].payload_json);
    expect(payload.fields).toEqual(["description"]);
    expect(JSON.stringify(payload)).not.toContain("confidentiel");
  });
});
