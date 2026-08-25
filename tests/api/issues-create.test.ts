import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const DEV_HEADER = { "X-Dev-User-Email": "creator@example.test", "Content-Type": "application/json" };

async function post(body: unknown) {
  return app.request(
    "http://local/api/issues",
    { method: "POST", headers: DEV_HEADER, body: JSON.stringify(body) },
    env
  );
}

let locationId: number;
let inactiveLocationId: number;
let categoryId: number;
let otherCategoryId: number;
let subcategoryId: number;
let impactTimeLostId: number;
let impactNoneExternalId: number;
let impactOtherId: number;

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
  ]);

  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'Créateur', 'employee', 1)"
  ).run();

  locationId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('TEST', 'Succursale test') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
  inactiveLocationId = (
    await env.DB.prepare(
      "INSERT INTO locations (code, label, active) VALUES ('INACTIVE', 'Succursale fermée', 0) RETURNING id"
    ).first<{ id: number }>()
  )!.id;
  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
  otherCategoryId = (
    await env.DB.prepare(
      "INSERT INTO categories (code, label) VALUES ('repairs', 'Réparations') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
  subcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'pricing_error', 'Erreur de prix') RETURNING id"
    )
      .bind(categoryId)
      .first<{ id: number }>()
  )!.id;
  impactTimeLostId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
  impactNoneExternalId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('none_external', 'Aucun impact externe') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
  impactOtherId = (
    await env.DB.prepare("INSERT INTO impact_types (code, label) VALUES ('other', 'Autre') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    occurredOn: "2026-08-20",
    locationId,
    categoryId,
    description: "Description suffisamment longue pour être valide.",
    priority: "normal",
    impacts: [{ impactTypeId: impactTimeLostId }],
    ...overrides,
  };
}

describe("POST /api/issues", () => {
  it("S01 — creates an issue with a valid location and returns 201 + ETag", async () => {
    const res = await post(validPayload());
    expect(res.status).toBe(201);
    expect(res.headers.get("ETag")).toMatch(/^"issue-\d+-v1"$/);

    const body = await res.json<{ ok: true; data: { publicId: string; status: string; rowVersion: number } }>();
    expect(body.data.publicId).toMatch(/^INC-\d{6,}$/);
    expect(body.data.status).toBe("new");
    expect(body.data.rowVersion).toBe(1);
  });

  it("S02 — refuses creation without a location (422)", async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).locationId;
    const res = await post(payload);
    expect(res.status).toBe(422);
    const body = await res.json<{ error: { code: string; fields: Record<string, string> } }>();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.locationId).toBeDefined();
  });

  it("refuses creation with an inactive location (422)", async () => {
    const res = await post(validPayload({ locationId: inactiveLocationId }));
    expect(res.status).toBe(422);
    const body = await res.json<{ error: { fields: Record<string, string> } }>();
    expect(body.error.fields.locationId).toBeDefined();
  });

  it("S03 — accepts creation without a subcategory", async () => {
    const res = await post(validPayload());
    expect(res.status).toBe(201);
    const body = await res.json<{ data: { subcategoryId: number | null } }>();
    expect(body.data.subcategoryId).toBeNull();
  });

  it("accepts creation with a subcategory that belongs to the chosen category", async () => {
    const res = await post(validPayload({ subcategoryId }));
    expect(res.status).toBe(201);
    const body = await res.json<{ data: { subcategoryId: number | null } }>();
    expect(body.data.subcategoryId).toBe(subcategoryId);
  });

  it("refuses a subcategory that belongs to a different category", async () => {
    const res = await post(validPayload({ categoryId: otherCategoryId, subcategoryId }));
    expect(res.status).toBe(422);
    const body = await res.json<{ error: { fields: Record<string, string> } }>();
    expect(body.error.fields.subcategoryId).toBeDefined();
  });

  it("refuses a description shorter than 10 characters", async () => {
    const res = await post(validPayload({ description: "trop bref" }));
    expect(res.status).toBe(422);
  });

  it("refuses an empty impacts array", async () => {
    const res = await post(validPayload({ impacts: [] }));
    expect(res.status).toBe(422);
  });

  it("refuses a duplicate impactTypeId", async () => {
    const res = await post(
      validPayload({ impacts: [{ impactTypeId: impactTimeLostId }, { impactTypeId: impactTimeLostId }] })
    );
    expect(res.status).toBe(422);
    const body = await res.json<{ error: { fields: Record<string, string> } }>();
    expect(body.error.fields.impacts).toBeDefined();
  });

  it('refuses "none_external" combined with another impact', async () => {
    const res = await post(
      validPayload({
        impacts: [{ impactTypeId: impactNoneExternalId }, { impactTypeId: impactTimeLostId }],
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json<{ error: { fields: Record<string, string> } }>();
    expect(body.error.fields.impacts).toBeDefined();
  });

  it('refuses "other" impact without details', async () => {
    const res = await post(validPayload({ impacts: [{ impactTypeId: impactOtherId }] }));
    expect(res.status).toBe(422);
  });

  it('accepts "other" impact with details', async () => {
    const res = await post(
      validPayload({ impacts: [{ impactTypeId: impactOtherId, details: "Précision nécessaire ici." }] })
    );
    expect(res.status).toBe(201);
  });

  it("persists the issue and its impacts atomically (readable back via GET-equivalent lookup)", async () => {
    const res = await post(validPayload({ impacts: [{ impactTypeId: impactTimeLostId, details: "Détail" }] }));
    expect(res.status).toBe(201);
    const body = await res.json<{ data: { publicId: string } }>();

    const idRow = await env.DB.prepare("SELECT id FROM issues WHERE 1=1").first<{ id: number }>();
    expect(idRow).not.toBeNull();
    const impactCount = await env.DB.prepare("SELECT count(*) as n FROM issue_impacts WHERE issue_id = ?")
      .bind(idRow!.id)
      .first<{ n: number }>();
    expect(impactCount?.n).toBe(1);
    expect(body.data.publicId).toContain(String(idRow!.id).padStart(6, "0"));
  });

  it("links every impact to the created issue, not to each other (regression: last_insert_rowid drift)", async () => {
    const impactWaterId = (
      await env.DB.prepare(
        "INSERT INTO impact_types (code, label) VALUES ('client_delay', 'Retard client') RETURNING id"
      ).first<{ id: number }>()
    )!.id;

    const res = await post(
      validPayload({
        impacts: [
          { impactTypeId: impactTimeLostId, details: "Un" },
          { impactTypeId: impactWaterId, details: "Deux" },
          { impactTypeId: impactOtherId, details: "Trois" },
        ],
      })
    );
    expect(res.status).toBe(201);

    const idRow = await env.DB.prepare("SELECT id FROM issues ORDER BY id DESC LIMIT 1").first<{ id: number }>();
    const { results } = await env.DB.prepare(
      "SELECT impact_type_id, details FROM issue_impacts WHERE issue_id = ? ORDER BY id"
    )
      .bind(idRow!.id)
      .all<{ impact_type_id: number; details: string }>();

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.impact_type_id).sort()).toEqual(
      [impactTimeLostId, impactWaterId, impactOtherId].sort()
    );

    // Aucune ligne issue_impacts ne doit avoir été mal rattachée à une
    // AUTRE ligne issue_impacts (ce qui arrivait avec last_insert_rowid()
    // dès le 2e impact).
    const orphanCount = await env.DB.prepare(
      "SELECT count(*) as n FROM issue_impacts WHERE issue_id != ?"
    )
      .bind(idRow!.id)
      .first<{ n: number }>();
    expect(orphanCount?.n).toBe(0);
  });

  it("ISSUE-04 — records an issue_created history event atomically with the issue", async () => {
    const res = await post(validPayload());
    expect(res.status).toBe(201);
    const body = await res.json<{ data: { publicId: string } }>();

    const idRow = await env.DB.prepare("SELECT id FROM issues ORDER BY id DESC LIMIT 1").first<{ id: number }>();
    const event = await env.DB.prepare(
      "SELECT actor_user_id, event_type, payload_json FROM issue_history WHERE issue_id = ?"
    )
      .bind(idRow!.id)
      .first<{ actor_user_id: number; event_type: string; payload_json: string }>();

    expect(event).not.toBeNull();
    expect(event?.event_type).toBe("issue_created");

    const creator = await env.DB.prepare("SELECT id FROM users WHERE email = 'creator@example.test'").first<{
      id: number;
    }>();
    expect(event?.actor_user_id).toBe(creator!.id);

    const payload = JSON.parse(event!.payload_json) as Record<string, unknown>;
    expect(payload).toEqual({
      locationId,
      departmentId: null,
      categoryId,
      subcategoryId: null,
      priority: "normal",
    });
    // L'historique ne doit jamais contenir de texte libre (description).
    expect(JSON.stringify(payload)).not.toContain("Description suffisamment longue");
    expect(body.data.publicId).toContain(String(idRow!.id).padStart(6, "0"));
  });

  it("rejects an unrecognized field (additionalProperties: false)", async () => {
    const res = await post(validPayload({ notInSchema: true }));
    expect(res.status).toBe(422);
  });

  it("refuses without an authenticated identity", async () => {
    const res = await app.request(
      "http://local/api/issues",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validPayload()) },
      env
    );
    expect(res.status).toBe(401);
  });
});
