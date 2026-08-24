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
      "INSERT INTO locations (code, label, active) VALUES ('INACTIVE-LOC', 'Succursale inactive', 0)"
    ).run();

    const res = await app.request("http://local/api/meta", { headers: DEV_HEADER }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{
      ok: true;
      data: {
        locations: Array<{ code: string; active: boolean }>;
        departments: unknown[];
        categories: unknown[];
        subcategories: unknown[];
        impactTypes: unknown[];
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
    expect(body.data.config).toEqual({
      businessTimeZone: "America/Toronto",
      maxAttachmentBytes: 10485760,
      maxAttachmentsPerIssue: 10,
      recurringWindowDays: 90,
      recurringMinCount: 3,
    });
  });
});
