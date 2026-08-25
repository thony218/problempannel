import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test", "Content-Type": "application/json" };
const ADMIN_HEADER = { "X-Dev-User-Email": "admin@example.test", "Content-Type": "application/json" };

let employeeId: number;
let managerId: number;
let adminId: number;
let locationId: number;
let categoryId: number;
let subcategoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM attachments"),
    env.DB.prepare("DELETE FROM comments"),
    env.DB.prepare("DELETE FROM issue_links"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM subcategories"),
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

  adminId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('admin@example.test', 'Admin', 'admin', 1) RETURNING id"
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

  subcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'price_error', 'Erreur de prix') RETURNING id"
    )
      .bind(categoryId)
      .first<{ id: number }>()
  )!.id;

  impactId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
});

describe("ADM-01 & ADM-02: Endpoints d'Administration", () => {
  it("enforces admin-only access on all /admin routes (403 for non-admins)", async () => {
    const resEmp = await app.request("http://local/api/admin/users", { headers: EMPLOYEE_HEADER }, env);
    expect(resEmp.status).toBe(403);

    const resMgr = await app.request("http://local/api/admin/users", { headers: MANAGER_HEADER }, env);
    expect(resMgr.status).toBe(403);

    const resAdmin = await app.request("http://local/api/admin/users", { headers: ADMIN_HEADER }, env);
    expect(resAdmin.status).toBe(200);
  });

  it("handles complete user management flow (ADM-01)", async () => {
    // 1. Créer un utilisateur
    const createRes = await app.request(
      "http://local/api/admin/users",
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          email: "nouveau@example.test",
          displayName: "Nouveau Recrue",
          role: "employee",
          active: true,
          defaultLocationId: locationId,
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const newUserId = ((await createRes.json()) as any).data.id;

    // 2. Modifier son rôle et statut
    const updateRes = await app.request(
      `http://local/api/admin/users/${newUserId}`,
      {
        method: "PATCH",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          role: "manager",
          active: false,
        }),
      },
      env
    );
    expect(updateRes.status).toBe(200);
    const updateBody = (await updateRes.json()) as any;
    expect(updateBody.data.role).toBe("manager");
    expect(updateBody.data.active).toBe(false);

    // 3. Rejet de doublon d'email (422)
    const dupRes = await app.request(
      "http://local/api/admin/users",
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          email: "nouveau@example.test",
          displayName: "Autre",
          role: "employee",
        }),
      },
      env
    );
    expect(dupRes.status).toBe(422);
  });

  it("handles reference items and subcategories management (ADM-02)", async () => {
    // 1. Créer une nouvelle succursale
    const locRes = await app.request(
      "http://local/api/admin/locations",
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          code: "LAVAL",
          label: "Succursale Laval",
          sortOrder: 20,
        }),
      },
      env
    );
    expect(locRes.status).toBe(201);
    const locId = ((await locRes.json()) as any).data.id;

    // 2. Modifier la succursale
    const updateLocRes = await app.request(
      `http://local/api/admin/locations/${locId}`,
      {
        method: "PATCH",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          label: "Laval Centre",
          active: true,
        }),
      },
      env
    );
    expect(updateLocRes.status).toBe(200);
    expect(((await updateLocRes.json()) as any).data.label).toBe("Laval Centre");

    // 3. Créer une nouvelle sous-catégorie
    const subcatRes = await app.request(
      "http://local/api/admin/subcategories",
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          categoryId,
          code: "discount_error",
          label: "Erreur de rabais",
          sortOrder: 10,
        }),
      },
      env
    );
    expect(subcatRes.status).toBe(201);
    const subcatBody = (await subcatRes.json()) as any;
    expect(subcatBody.data.parentId).toBe(categoryId);
  });
});

describe("V3-PRIV-01: Procédure de Caviardage de données sensibles", () => {
  it("redacts issue text fields, deletes comments, and purges R2 attachments with clean audit log", async () => {
    // 1. Créer un incident avec données sensibles
    const createRes = await app.request(
      "http://local/api/issues",
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({
          occurredOn: "2026-08-20",
          locationId,
          categoryId,
          description: "Le client Jean Dupont (NAS: 123-456-789) a été facturé en double.",
          priority: "urgent",
          impacts: [{ impactTypeId: impactId, details: "Donnée confidentielle" }],
        }),
      },
      env
    );
    const publicId = ((await createRes.json()) as any).data.publicId;

    // 2. Ajouter un commentaire
    const comRes = await app.request(
      `http://local/api/issues/${publicId}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Voici le numéro de carte de crédit : 4500 1234 5678 9012" }),
      },
      env
    );
    const commentId = ((await comRes.json()) as any).data.id;

    // 3. Téléverser une pièce jointe sur R2
    const formData = new FormData();
    const file = new File(["IMAGE_CONTENT_NAS"], "scan_identite.jpg", { type: "image/jpeg" });
    formData.append("file", file);
    const attRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: { "X-Dev-User-Email": "emp@example.test" }, body: formData },
      env
    );
    const attachmentId = ((await attRes.json()) as any).data.id;

    // 4. Rejet du caviardage par un gestionnaire ou employé (403)
    const empRedactRes = await app.request(
      `http://local/api/admin/issues/${publicId}/redact`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({
          issueTextFields: ["description"],
          reason: "Demande RGPD/Loi 25 du client",
        }),
      },
      env
    );
    expect(empRedactRes.status).toBe(403);

    // 5. Caviardage exécuté avec succès par l'administrateur
    const adminRedactRes = await app.request(
      `http://local/api/admin/issues/${publicId}/redact`,
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          issueTextFields: ["description"],
          commentIds: [commentId],
          attachmentIds: [attachmentId],
          reason: "Demande de droit à l'oubli / données personnelles sensibles",
        }),
      },
      env
    );
    expect(adminRedactRes.status).toBe(200);
    const redactBody = (await adminRedactRes.json()) as any;
    expect(redactBody.data.description).toBe("[CAVIARDÉ]");
    expect(redactBody.data.redactedAt).not.toBeNull();
    expect(redactBody.data.redactionReason).toBe("Demande de droit à l'oubli / données personnelles sensibles");

    // 6. Vérifier que le commentaire est caviardé (body null, deleted true)
    const comListRes = await app.request(`http://local/api/issues/${publicId}/comments`, { headers: EMPLOYEE_HEADER }, env);
    const comListBody = (await comListRes.json()) as any;
    expect(comListBody.data.items[0].deleted).toBe(true);
    expect(comListBody.data.items[0].body).toBeNull();

    // 7. Vérifier que la pièce jointe a été purgée de R2
    const attListRes = await app.request(`http://local/api/issues/${publicId}/attachments`, { headers: EMPLOYEE_HEADER }, env);
    const attListBody = (await attListRes.json()) as any;
    expect(attListBody.data).toHaveLength(0);

    // 8. Vérifier l'historique d'audit (ne contient AUCUNE valeur brute sensible)
    const historyRes = await app.request(`http://local/api/issues/${publicId}/history`, { headers: EMPLOYEE_HEADER }, env);
    const historyBody = (await historyRes.json()) as any;
    const redactEvent = historyBody.data.items.find((it: any) => it.eventType === "issue_redacted");
    expect(redactEvent).toBeDefined();
    expect(JSON.stringify(redactEvent.payload)).not.toContain("NAS: 123-456-789");
    expect(JSON.stringify(redactEvent.payload)).not.toContain("4500 1234");
  });
});
