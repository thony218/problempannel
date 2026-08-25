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
    env.DB.prepare("DELETE FROM issue_links"),
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

async function createIssue(desc: string) {
  const res = await app.request(
    "http://local/api/issues",
    {
      method: "POST",
      headers: EMPLOYEE_HEADER,
      body: JSON.stringify({
        occurredOn: "2026-08-20",
        locationId,
        categoryId,
        description: desc,
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string };
}

describe("LINK-01: API des liaisons de dossiers (similar links)", () => {
  it("enforces role permissions and creates link between two issues", async () => {
    const issueA = await createIssue("Premier dossier");
    const issueB = await createIssue("Deuxième dossier similaire");

    // 1. Rejet si un employé tente de lier deux dossiers (403)
    const empRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ relatedPublicId: issueB.publicId }),
      },
      env
    );
    expect(empRes.status).toBe(403);

    // 2. Création réussie par un gestionnaire (201)
    const mgrRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ relatedPublicId: issueB.publicId }),
      },
      env
    );
    expect(mgrRes.status).toBe(201);
    const mgrBody = (await mgrRes.json()) as any;
    expect(mgrBody.data.relatedPublicId).toBe(issueB.publicId);
    expect(mgrBody.data.linkType).toBe("similar");

    // 3. Consultation symétrique des liens (GET sur A retourne B, GET sur B retourne A)
    const listResA = await app.request(`http://local/api/issues/${issueA.publicId}/links`, { headers: EMPLOYEE_HEADER }, env);
    expect(listResA.status).toBe(200);
    const listBodyA = (await listResA.json()) as any;
    expect(listBodyA.data).toHaveLength(1);
    expect(listBodyA.data[0].relatedPublicId).toBe(issueB.publicId);

    const listResB = await app.request(`http://local/api/issues/${issueB.publicId}/links`, { headers: EMPLOYEE_HEADER }, env);
    expect(listResB.status).toBe(200);
    const listBodyB = (await listResB.json()) as any;
    expect(listBodyB.data).toHaveLength(1);
    expect(listBodyB.data[0].relatedPublicId).toBe(issueA.publicId);

    // 4. Vérification des événements d'historique (sur A et sur B)
    const historyRows = await env.DB.prepare(
      "SELECT issue_id, event_type FROM issue_history WHERE event_type = 'link_created'"
    ).all();
    expect(historyRows.results).toHaveLength(2);
  });

  it("rejects linking an issue to itself or duplicate links (422 / 409)", async () => {
    const issueA = await createIssue("Dossier alpha de test");
    const issueB = await createIssue("Dossier bêta de test");

    // Auto-lien -> 422
    const selfRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ relatedPublicId: issueA.publicId }),
      },
      env
    );
    expect(selfRes.status).toBe(422);

    // Lien initial
    await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ relatedPublicId: issueB.publicId }),
      },
      env
    );

    // Doublon -> 409
    const dupRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ relatedPublicId: issueB.publicId }),
      },
      env
    );
    expect(dupRes.status).toBe(409);
  });

  it("handles link removal with role permissions (DELETE)", async () => {
    const issueA = await createIssue("Premier dossier pour suppression");
    const issueB = await createIssue("Deuxième dossier pour suppression");

    // Créer le lien
    await app.request(
      `http://local/api/issues/${issueA.publicId}/links`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ relatedPublicId: issueB.publicId }),
      },
      env
    );

    // 1. Rejet si un employé tente de supprimer (403)
    const empDelRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links/${issueB.publicId}`,
      { method: "DELETE", headers: EMPLOYEE_HEADER },
      env
    );
    expect(empDelRes.status).toBe(403);

    // 2. Suppression réussie par un gestionnaire (204)
    const mgrDelRes = await app.request(
      `http://local/api/issues/${issueA.publicId}/links/${issueB.publicId}`,
      { method: "DELETE", headers: MANAGER_HEADER },
      env
    );
    expect(mgrDelRes.status).toBe(204);

    // 3. Vérifier que la liste est vide
    const listRes = await app.request(`http://local/api/issues/${issueA.publicId}/links`, { headers: EMPLOYEE_HEADER }, env);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data).toHaveLength(0);
  });
});
