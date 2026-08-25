import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

/**
 * OPS-03 — limitation de débit (02_contrats/04_SECURITE_AUTH.md).
 *
 * Les bindings `WRITE_RATE_LIMIT` (120/min) et `UPLOAD_RATE_LIMIT` (20/min)
 * étaient déclarés dans `wrangler.jsonc` et typés dans
 * `worker-configuration.d.ts`, mais aucun code ne les appelait : une
 * configuration décorative que rien ne signalait.
 *
 * La clé de quota est l'identifiant interne, pas l'IP : plusieurs employés
 * d'une même succursale partagent une sortie réseau et ne doivent pas se
 * pénaliser mutuellement.
 */

const UPLOADER_HEADER = { "X-Dev-User-Email": "uploader@example.test" };
const OTHER_HEADER = { "X-Dev-User-Email": "other-uploader@example.test" };

let locationId: number;
let categoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM attachments"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);

  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES ('uploader@example.test', 'Téléverseur', 'employee', 1)"
  ).run();
  await env.DB.prepare(
    "INSERT INTO users (email, display_name, role, active) VALUES ('other-uploader@example.test', 'Collègue', 'employee', 1)"
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
    await env.DB.prepare("INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
});

async function createIssue(): Promise<string> {
  const res = await app.request(
    "http://local/api/issues",
    {
      method: "POST",
      headers: { ...UPLOADER_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        occurredOn: "2026-08-20",
        locationId,
        categoryId,
        description: "Dossier servant aux essais de quota.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId }],
      }),
    },
    env
  );
  return ((await res.json()) as any).data.publicId as string;
}

async function upload(publicId: string, headers: Record<string, string>): Promise<Response> {
  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", { type: "image/jpeg" }));
  return app.request(
    `http://local/api/issues/${publicId}/attachments`,
    { method: "POST", headers, body: formData },
    env
  );
}

describe("OPS-03 : limitation de débit sur les téléversements", () => {
  it("returns 429 once the per-user upload quota is exhausted", async () => {
    // Le quota est de 20/minute ; la limite de 10 pièces jointes par dossier
    // impose de répartir les envois sur plusieurs dossiers.
    const issues = [await createIssue(), await createIssue(), await createIssue()];

    const statuses: number[] = [];
    for (let i = 0; i < 24; i++) {
      const res = await upload(issues[Math.floor(i / 8)], UPLOADER_HEADER);
      statuses.push(res.status);
    }

    const limited = statuses.filter((s) => s === 429);
    expect(limited.length).toBeGreaterThan(0);

    // Le refus est un vrai refus de quota, pas un effet de bord d'une autre règle.
    const lastLimited = await upload(issues[0], UPLOADER_HEADER);
    expect(lastLimited.status).toBe(429);
    const body = (await lastLimited.json()) as any;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.requestId).toBeTruthy();
  });

  it("keeps one user's quota from penalising another", async () => {
    const issue = await createIssue();

    // Épuise le quota du premier utilisateur.
    for (let i = 0; i < 25; i++) {
      await upload(issue, UPLOADER_HEADER);
    }
    expect((await upload(issue, UPLOADER_HEADER)).status).toBe(429);

    // Le collègue n'est pas affecté : son envoi échoue sur le quota de pièces
    // jointes du dossier (422), jamais sur la limitation de débit.
    const otherRes = await upload(issue, OTHER_HEADER);
    expect(otherRes.status).not.toBe(429);
  });
});
