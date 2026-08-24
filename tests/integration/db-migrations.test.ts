import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("D1 migrations", () => {
  it("creates the core tables", async () => {
    const result = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='issues'"
    ).first<{ name: string }>();
    expect(result?.name).toBe("issues");
  });
});
