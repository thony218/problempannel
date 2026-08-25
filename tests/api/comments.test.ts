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
    env.DB.prepare("DELETE FROM comments"),
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
        description: "Incident initial pour tester les commentaires.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string };
}

describe("COM-01 & COM-02: API des commentaires", () => {
  it("allows any active user to create and list comments on an issue (COM-01)", async () => {
    const { publicId } = await createIssue();

    // 1. Liste initiale vide
    const listRes1 = await app.request(`http://local/api/issues/${publicId}/comments`, { headers: EMPLOYEE_HEADER }, env);
    expect(listRes1.status).toBe(200);
    const listBody1 = (await listRes1.json()) as any;
    expect(listBody1.data.items).toHaveLength(0);

    // 2. Création de commentaire par un employé
    const createRes = await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Premier commentaire par l'employé." }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as any;
    expect(createBody.data.body).toBe("Premier commentaire par l'employé.");
    expect(createBody.data.userId).toBe(employeeId);
    expect(createBody.data.deleted).toBe(false);

    // 3. Liste mise à jour
    const listRes2 = await app.request(`http://local/api/issues/${publicId}/comments`, { headers: MANAGER_HEADER }, env);
    expect(listRes2.status).toBe(200);
    const listBody2 = (await listRes2.json()) as any;
    expect(listBody2.data.items).toHaveLength(1);
    expect(listBody2.data.items[0].body).toBe("Premier commentaire par l'employé.");

    // 4. Vérifier l'événement d'historique
    const historyRows = await env.DB.prepare(
      "SELECT event_type FROM issue_history WHERE event_type = 'comment_created'"
    ).all();
    expect(historyRows.results).toHaveLength(1);
  });

  it("rejects creating comment with empty body or on non-existent issue (422 / 404)", async () => {
    const { publicId } = await createIssue();

    const emptyRes = await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "" }),
      },
      env
    );
    expect(emptyRes.status).toBe(422);

    const notFoundRes = await app.request(
      "http://local/api/issues/INC-999999/comments",
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Commentaire orphelin." }),
      },
      env
    );
    expect(notFoundRes.status).toBe(404);
  });

  it("handles soft-delete of comments with permissions and reason (COM-02)", async () => {
    const { publicId } = await createIssue();

    const createRes = await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Commentaire à supprimer." }),
      },
      env
    );
    const commentId = ((await createRes.json()) as any).data.id;

    // 1. Rejet si un employé tente de soft-delete (403)
    const empDeleteRes = await app.request(
      `http://local/api/comments/${commentId}`,
      {
        method: "DELETE",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ reason: "Suppression non autorisée." }),
      },
      env
    );
    expect(empDeleteRes.status).toBe(403);

    // 2. Rejet si le motif fait moins de 5 caractères (422)
    const shortReasonRes = await app.request(
      `http://local/api/comments/${commentId}`,
      {
        method: "DELETE",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ reason: "abc" }),
      },
      env
    );
    expect(shortReasonRes.status).toBe(422);

    // 3. Succès par un gestionnaire (204)
    const managerDeleteRes = await app.request(
      `http://local/api/comments/${commentId}`,
      {
        method: "DELETE",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ reason: "Commentaire inapproprié ou doublon." }),
      },
      env
    );
    expect(managerDeleteRes.status).toBe(204);

    // 4. Vérifier que dans la liste, le commentaire a body = null et deleted = true
    const listRes = await app.request(`http://local/api/issues/${publicId}/comments`, { headers: EMPLOYEE_HEADER }, env);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data.items[0].deleted).toBe(true);
    expect(listBody.data.items[0].body).toBeNull();
    expect(listBody.data.items[0].deletedAt).not.toBeNull();

    // 5. Vérifier l'événement d'historique comment_deleted
    const historyRows = await env.DB.prepare(
      "SELECT event_type FROM issue_history WHERE event_type = 'comment_deleted'"
    ).all();
    expect(historyRows.results).toHaveLength(1);
  });
/**
   * G-007 (historique append-only) : un second DELETE ne doit pas réécrire
   * silencieusement l'auteur/le motif de la suppression d'origine ni empiler
   * un deuxième événement `comment_deleted` pour le même commentaire.
   * Aligne le comportement sur celui des pièces jointes (`deleteAttachment`).
   */
  it("rejects deleting an already soft-deleted comment without overwriting the original trace (404)", async () => {
    const { publicId } = await createIssue();

    const createRes = await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Commentaire à supprimer une seule fois." }),
      },
      env
    );
    const commentId = ((await createRes.json()) as any).data.id;

    const firstDelete = await app.request(
      `http://local/api/comments/${commentId}`,
      {
        method: "DELETE",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ reason: "Motif initial de suppression." }),
      },
      env
    );
    expect(firstDelete.status).toBe(204);

    const secondDelete = await app.request(
      `http://local/api/comments/${commentId}`,
      {
        method: "DELETE",
        headers: MANAGER_HEADER,
        body: JSON.stringify({ reason: "Motif de remplacement frauduleux." }),
      },
      env
    );
    expect(secondDelete.status).toBe(404);

    const row = await env.DB.prepare("SELECT delete_reason FROM comments WHERE id = ?")
      .bind(commentId)
      .first<{ delete_reason: string }>();
    expect(row!.delete_reason).toBe("Motif initial de suppression.");

    const historyRows = await env.DB.prepare(
      "SELECT event_type FROM issue_history WHERE event_type = 'comment_deleted'"
    ).all();
    expect(historyRows.results).toHaveLength(1);
  });
});
