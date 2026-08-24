import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

async function seedUser(overrides: Partial<{ email: string; role: string; active: number }> = {}) {
  await env.DB.prepare(
    `INSERT INTO users (email, display_name, role, active)
     VALUES (?, 'Utilisateur Test', ?, ?)`
  )
    .bind(
      overrides.email ?? "employee@example.test",
      overrides.role ?? "employee",
      overrides.active ?? 1
    )
    .run();
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM users").run();
});

describe("GET /api/me", () => {
  it("refuses without X-Dev-User-Email in local mode", async () => {
    const res = await app.request("http://local/api/me", {}, env);
    expect(res.status).toBe(401);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("refuses when no internal user matches the identity", async () => {
    const res = await app.request(
      "http://local/api/me",
      { headers: { "X-Dev-User-Email": "ghost@example.test" } },
      env
    );
    expect(res.status).toBe(401);
  });

  it("refuses with 403 USER_INACTIVE when the user is inactive", async () => {
    await seedUser({ email: "inactive@example.test", active: 0 });
    const res = await app.request(
      "http://local/api/me",
      { headers: { "X-Dev-User-Email": "inactive@example.test" } },
      env
    );
    expect(res.status).toBe(403);
    const body = await res.json<{ error: { code: string } }>();
    expect(body.error.code).toBe("USER_INACTIVE");
  });

  it("returns the current user when active", async () => {
    await seedUser({ email: "active@example.test", role: "manager", active: 1 });
    const res = await app.request(
      "http://local/api/me",
      { headers: { "X-Dev-User-Email": "active@example.test" } },
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: true; data: { email: string; role: string; active: boolean } }>();
    expect(body.data.email).toBe("active@example.test");
    expect(body.data.role).toBe("manager");
    expect(body.data.active).toBe(true);
  });

  it("matches the identity email case-insensitively", async () => {
    await seedUser({ email: "MixedCase@example.test", active: 1 });
    const res = await app.request(
      "http://local/api/me",
      { headers: { "X-Dev-User-Email": "mixedcase@example.test" } },
      env
    );
    expect(res.status).toBe(200);
  });
});
