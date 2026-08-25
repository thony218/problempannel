import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const DEV_HEADER = { "X-Dev-User-Email": "meta-tester@example.test" };

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES (?, 'Meta Tester', 'employee', 1)"
  )
    .bind(DEV_HEADER["X-Dev-User-Email"])
    .run();
});

describe("GET /api/meta", () => {
  it("refuses without an authenticated identity", async () => {
    const res = await app.request("http://local/api/meta", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns only active reference items and the expected config", async () => {
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('inactive@example.test', 'Ancien employé', 'employee', 0)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO locations (code, label, active) VALUES ('INACTIVE-LOC', 'Succursale inactive', 0)"
    ).run();
    await env.DB.prepare(
      "INSERT INTO locations (code, label, active) VALUES ('ACTIVE-LOC', 'Succursale active', 1)"
    ).run();
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes')").run();
    await env.DB.prepare(
      `INSERT INTO subcategories (category_id, code, label)
       SELECT id, 'pricing_error', 'Erreur de prix' FROM categories WHERE code = 'sales'`
    ).run();

    const res = await app.request("http://local/api/meta", { headers: DEV_HEADER }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: true;
      data: {
        locations: Array<{ code: string; active: boolean; parentId?: number | null }>;
        departments: unknown[];
        categories: Array<{ id: number; code: string }>;
        subcategories: Array<{ code: string; parentId?: number | null }>;
        impactTypes: unknown[];
        users: Array<Record<string, unknown> & { id: number; displayName: string; active: boolean }>;
        config: {
          businessTimeZone: string;
          maxAttachmentBytes: number;
          maxAttachmentsPerIssue: number;
          recurringWindowDays: number;
          recurringMinCount: number;
        };
      };
    }>();

    expect(body.data.locations.some((l) => l.code === "INACTIVE-LOC")).toBe(false);
    expect(body.data.users.map((u) => u.displayName)).toEqual(["Meta Tester", "Ancien employé"]);
    expect(body.data.users.every((u) => !("email" in u))).toBe(true);
    expect(body.data.users.find((u) => u.displayName === "Ancien employé")?.active).toBe(false);
    expect(body.data.locations[0].parentId).toBeUndefined();
    expect(body.data.config).toEqual({
      businessTimeZone: "America/Toronto",
      maxAttachmentBytes: 10485760,
      maxAttachmentsPerIssue: 10,
      recurringWindowDays: 90,
      recurringMinCount: 3,
    });

    const salesCategory = body.data.categories.find((c) => c.code === "sales");
    const pricingError = body.data.subcategories.find((s) => s.code === "pricing_error");
    expect(salesCategory).toBeDefined();
    expect(pricingError?.parentId).toBe(salesCategory?.id);
  });
});
