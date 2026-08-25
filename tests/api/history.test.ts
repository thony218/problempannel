import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test", "Content-Type": "application/json" };

let employeeId: number;
let managerId: number;
let locationId: number;
let categoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM corrective_actions"),
    env.DB.prepare("DELETE FROM comments"),
    env.DB.prepare("DELETE FROM attachments"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);

  employeeId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('emp@example.test', 'Employé', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  managerId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('manager@example.test', 'Gestionnaire', 'manager', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  locationId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('MTL', 'Montréal') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  impactId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
});

async function createIssue() {
  const res = await app.request(
    "http://local/api/issues",
    {
      method: "POST",
      headers: EMPLOYEE_HEADER,
      body: JSON.stringify({
        occurredOn: "2026-08-20",
        locationId,
        categoryId,
        description: "Incident initial pour tester l'historique.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string, etag: res.headers.get("ETag") as string };
}

describe("HIST-01: API de l'historique d'audit append-only", () => {
  it("records chronological events and returns them via GET /issues/{publicId}/history", async () => {
    const { publicId, etag } = await createIssue();

    // 1. Ajouter un commentaire
    await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Premier commentaire pour test d'historique." }),
      },
      env
    );

    // 2. Mettre à jour l'issue par un gestionnaire
    await app.request(
      `http://local/api/issues/${publicId}`,
      {
        method: "PATCH",
        headers: { ...MANAGER_HEADER, "If-Match": etag },
        body: JSON.stringify({ priority: "urgent" }),
      },
      env
    );

    // 3. Récupérer l'historique complet
    const historyRes = await app.request(
      `http://local/api/issues/${publicId}/history`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(historyRes.status).toBe(200);
    const historyBody = (await historyRes.json()) as any;
    expect(historyBody.data.items).toHaveLength(3);

    const eventTypes = historyBody.data.items.map((it: any) => it.eventType);
    expect(eventTypes).toContain("issue_created");
    expect(eventTypes).toContain("comment_created");
    expect(eventTypes).toContain("issue_updated");

    for (const item of historyBody.data.items) {
      expect(item.issuePublicId).toBe(publicId);
      expect(item.createdAt).toBeDefined();
    }
  });

  it("supports pagination by cursor on issue history", async () => {
    const { publicId } = await createIssue();

    // Créer 3 commentaires
    for (let i = 1; i <= 3; i++) {
      await app.request(
        `http://local/api/issues/${publicId}/comments`,
        {
          method: "POST",
          headers: EMPLOYEE_HEADER,
          body: JSON.stringify({ body: `Commentaire ${i}` }),
        },
        env
      );
    }

    // Page 1 avec limit=2 (issue_created + comment_created 1)
    const page1Res = await app.request(
      `http://local/api/issues/${publicId}/history?limit=2`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(page1Res.status).toBe(200);
    const page1 = (await page1Res.json()) as any;
    expect(page1.data.items).toHaveLength(2);
    expect(page1.data.hasMore).toBe(true);
    expect(page1.data.nextCursor).not.toBeNull();

    // Page 2 avec le curseur
    const page2Res = await app.request(
      `http://local/api/issues/${publicId}/history?limit=2&cursor=${page1.data.nextCursor}`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(page2Res.status).toBe(200);
    const page2 = (await page2Res.json()) as any;
    expect(page2.data.items).toHaveLength(2);
    expect(page2.data.hasMore).toBe(false);
  });

  it("returns 404 for non-existent issue history", async () => {
    const res = await app.request(
      "http://local/api/issues/INC-999999/history",
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(res.status).toBe(404);
  });
});
