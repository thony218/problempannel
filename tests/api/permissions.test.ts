import { Hono } from "hono";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { AppEnv } from "../../worker/domain/types";
import { AppError, errorBody, okBody } from "../../worker/domain/errors";
import { requireRole, requireUser } from "../../worker/auth/middleware";

const adminOnly = new Hono<AppEnv>();
adminOnly.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, "req_test", err.fields), err.status as never);
  }
  return c.json(errorBody("INTERNAL_ERROR", "Erreur interne.", "req_test"), 500);
});
adminOnly.get("/admin-only", requireUser, requireRole("admin"), (c) => c.json(okBody({ ok: true })));

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("requireRole", () => {
  it("forbids a role not in the allowed list", async () => {
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('employee@example.test', 'Employé', 'employee', 1)"
    ).run();

    const res = await adminOnly.request(
      "http://local/admin-only",
      { headers: { "X-Dev-User-Email": "employee@example.test" } },
      env
    );
    expect(res.status).toBe(403);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("allows a role in the allowed list", async () => {
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('admin@example.test', 'Admin', 'admin', 1)"
    ).run();

    const res = await adminOnly.request(
      "http://local/admin-only",
      { headers: { "X-Dev-User-Email": "admin@example.test" } },
      env
    );
    expect(res.status).toBe(200);
  });
});
