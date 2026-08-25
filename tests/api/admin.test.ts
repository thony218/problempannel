import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";
import { jpegFile } from "./support/fixtures";

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
    const file = jpegFile("scan_identite.jpg", "IMAGE_CONTENT_NAS");
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
/**
   * Régression : une cible inconnue ou appartenant à un autre dossier ne doit
   * pas produire un 200. L'`UPDATE ... WHERE id = ? AND issue_id = ?` ne
   * touchait alors aucune ligne et l'administrateur recevait une confirmation
   * de destruction pour une donnée restée en clair — le pire mode d'échec
   * pour une procédure de droit à l'oubli (01_produit/09_CAVIARDAGE_ET_HISTORIQUE.md).
   */
  it("refuses to redact a target that belongs to another issue, without touching anything", async () => {
    const mkIssue = async (description: string) => {
      const res = await app.request(
        "http://local/api/issues",
        {
          method: "POST",
          headers: EMPLOYEE_HEADER,
          body: JSON.stringify({
            occurredOn: "2026-08-20",
            locationId,
            categoryId,
            description,
            priority: "normal",
            impacts: [{ impactTypeId: impactId }],
          }),
        },
        env
      );
      return ((await res.json()) as any).data.publicId as string;
    };

    const targetIssue = await mkIssue("Dossier visé par le caviardage, description longue.");
    const otherIssue = await mkIssue("Dossier voisin non concerné, description longue.");

    const comRes = await app.request(
      `http://local/api/issues/${otherIssue}/comments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ body: "Donnée sensible appartenant au dossier voisin." }),
      },
      env
    );
    const foreignCommentId = ((await comRes.json()) as any).data.id;

    const res = await app.request(
      `http://local/api/admin/issues/${targetIssue}/redact`,
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          issueTextFields: ["description"],
          commentIds: [foreignCommentId, 999999],
          reason: "Demande de droit à l'oubli",
        }),
      },
      env
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.commentIds).toContain("introuvable");

    // Le commentaire du dossier voisin est intact...
    const foreign = await env.DB.prepare("SELECT body, deleted_at FROM comments WHERE id = ?")
      .bind(foreignCommentId)
      .first<{ body: string; deleted_at: string | null }>();
    expect(foreign!.body).toBe("Donnée sensible appartenant au dossier voisin.");
    expect(foreign!.deleted_at).toBeNull();

    // ...et le dossier visé n'a subi aucun caviardage partiel.
    const target = await env.DB.prepare(
      "SELECT description, redacted_at FROM issues WHERE id = ?"
    )
      .bind(Number(targetIssue.replace("INC-", "")))
      .first<{ description: string; redacted_at: string | null }>();
    expect(target!.description).toBe("Dossier visé par le caviardage, description longue.");
    expect(target!.redacted_at).toBeNull();
  });

  /**
   * S43 / S44 : un motif seul, ou des tableaux de cibles vides, ne constituent
   * pas une cible de caviardage.
   */
  it("rejects a redaction with a reason but no target (S43, S44)", async () => {
    const createRes = await app.request(
      "http://local/api/issues",
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({
          occurredOn: "2026-08-20",
          locationId,
          categoryId,
          description: "Dossier de contrôle des cibles vides.",
          priority: "normal",
          impacts: [{ impactTypeId: impactId }],
        }),
      },
      env
    );
    const publicId = ((await createRes.json()) as any).data.publicId;

    for (const payload of [
      { reason: "Motif sans aucune cible" },
      { reason: "Motif avec cibles vides", issueTextFields: [], commentIds: [], attachmentIds: [] },
    ]) {
      const res = await app.request(
        `http://local/api/admin/issues/${publicId}/redact`,
        { method: "POST", headers: ADMIN_HEADER, body: JSON.stringify(payload) },
        env
      );
      expect(res.status).toBe(422);
    }
  });
/**
   * S37 : « caviardage PJ retire l'objet R2 ciblé ».
   *
   * Le test principal ne vérifiait que l'absence de la pièce jointe dans la
   * liste — or cette liste filtre sur `deleted_at`, donc elle passerait tout
   * aussi bien si le fichier était toujours dans le bucket. Ici, on interroge
   * R2 directement.
   */
  it("physically removes the targeted object from R2, not just its row (S37)", async () => {
    const createRes = await app.request(
      "http://local/api/issues",
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({
          occurredOn: "2026-08-20",
          locationId,
          categoryId,
          description: "Dossier avec pièce jointe à purger physiquement.",
          priority: "normal",
          impacts: [{ impactTypeId: impactId }],
        }),
      },
      env
    );
    const publicId = ((await createRes.json()) as any).data.publicId;

    const formData = new FormData();
    formData.append("file", jpegFile("piece.jpg", "CONTENU_SENSIBLE"));
    const attRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: { "X-Dev-User-Email": "emp@example.test" }, body: formData },
      env
    );
    const attachmentId = ((await attRes.json()) as any).data.id;

    const r2Key = (
      await env.DB.prepare("SELECT r2_key FROM attachments WHERE id = ?")
        .bind(attachmentId)
        .first<{ r2_key: string }>()
    )!.r2_key;

    expect(await env.ATTACHMENTS.get(r2Key)).not.toBeNull();

    const res = await app.request(
      `http://local/api/admin/issues/${publicId}/redact`,
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({ attachmentIds: [attachmentId], reason: "Destruction demandée" }),
      },
      env
    );
    expect(res.status).toBe(200);

    expect(await env.ATTACHMENTS.get(r2Key)).toBeNull();
  });
/**
   * Verrouillage irréversible : l'écran Administration permettait en deux
   * clics de se désactiver ou de se rétrograder. Une fois le dernier
   * administrateur parti, plus aucun compte ne peut créer ni promouvoir un
   * utilisateur — la seule sortie est un accès SQL direct à la base de
   * production.
   */
  it("refuses an update that would leave no active administrator", async () => {
    // `adminId` est le seul administrateur actif du jeu de test.
    const deactivateRes = await app.request(
      `http://local/api/admin/users/${adminId}`,
      { method: "PATCH", headers: ADMIN_HEADER, body: JSON.stringify({ active: false }) },
      env
    );
    expect(deactivateRes.status).toBe(422);

    const demoteRes = await app.request(
      `http://local/api/admin/users/${adminId}`,
      { method: "PATCH", headers: ADMIN_HEADER, body: JSON.stringify({ role: "employee" }) },
      env
    );
    expect(demoteRes.status).toBe(422);

    // L'accès administrateur reste opérationnel.
    const stillAdmin = await app.request("http://local/api/admin/users", { headers: ADMIN_HEADER }, env);
    expect(stillAdmin.status).toBe(200);
  });

  it("allows stepping down once another active administrator exists", async () => {
    const createRes = await app.request(
      "http://local/api/admin/users",
      {
        method: "POST",
        headers: ADMIN_HEADER,
        body: JSON.stringify({
          email: "admin2@example.test",
          displayName: "Second administrateur",
          role: "admin",
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);

    const demoteRes = await app.request(
      `http://local/api/admin/users/${adminId}`,
      { method: "PATCH", headers: ADMIN_HEADER, body: JSON.stringify({ role: "employee" }) },
      env
    );
    expect(demoteRes.status).toBe(200);
  });
});
