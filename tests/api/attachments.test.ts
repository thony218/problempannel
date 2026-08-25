import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test" };

let employeeId: number;
let managerId: number;
let locationId: number;
let categoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
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
      headers: { ...EMPLOYEE_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        occurredOn: "2026-08-20",
        locationId,
        categoryId,
        description: "Incident initial pour tester les pièces jointes.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string };
}

describe("ATT-01 & ATT-02: Upload et gestion des pièces jointes R2 (S17-S22)", () => {
  it("S17: uploads and downloads valid JPEG attachment", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", { type: "image/jpeg" });
    formData.append("file", file);

    const uploadRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: formData,
      },
      env
    );

    expect(uploadRes.status).toBe(201);
    const uploadBody = (await uploadRes.json()) as any;
    expect(uploadBody.data.originalName).toBe("photo.jpg");
    expect(uploadBody.data.contentType).toBe("image/jpeg");
    expect(uploadBody.data.uploadedByUserId).toBe(employeeId);

    const attachmentId = uploadBody.data.id;

    // Téléchargement du fichier
    const downloadRes = await app.request(
      `http://local/api/attachments/${attachmentId}`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("S21: rejects unsupported MIME type with 415", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    const file = new File(["texte brut"], "notes.txt", { type: "text/plain" });
    formData.append("file", file);

    const uploadRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: formData,
      },
      env
    );

    expect(uploadRes.status).toBe(415);
  });

  it("S20: rejects file larger than 10 MiB with 413", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    // Créer un blob factice de 10 Mo + 1 octet
    const bigBlob = new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "application/pdf" });
    formData.append("file", bigBlob, "huge.pdf");

    const uploadRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: formData,
      },
      env
    );

    expect(uploadRes.status).toBe(413);
  });

  it("S22: rejects 11th attachment on same issue with 422", async () => {
    const { publicId } = await createIssue();
    const issueId = Number(publicId.replace("INC-", ""));

    // Insérer 10 pièces jointes déjà existantes
    for (let i = 1; i <= 10; i++) {
      await env.DB.prepare(
        `INSERT INTO attachments (issue_id, uploaded_by_user_id, original_name, content_type, size_bytes, r2_key)
         VALUES (?, ?, ?, 'image/jpeg', 100, ?)`
      )
        .bind(issueId, employeeId, `img_${i}.jpg`, `key_${i}`)
        .run();
    }

    const formData = new FormData();
    const file = new File(["123"], "img_11.jpg", { type: "image/jpeg" });
    formData.append("file", file);

    const uploadRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: formData,
      },
      env
    );

    expect(uploadRes.status).toBe(422);
    const body = (await uploadRes.json()) as any;
    expect(body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
  });

  it("handles soft-delete with role permissions (manager/admin only, 403/204)", async () => {
    const { publicId } = await createIssue();
    const issueId = Number(publicId.replace("INC-", ""));

    const insertRes = await env.DB.prepare(
      `INSERT INTO attachments (issue_id, uploaded_by_user_id, original_name, content_type, size_bytes, r2_key)
       VALUES (?, ?, 'document.pdf', 'application/pdf', 500, 'test_key') RETURNING id`
    )
      .bind(issueId, employeeId)
      .first<{ id: number }>();
    const attachmentId = insertRes!.id;

    // 1. Rejet si un employé tente de supprimer (403)
    const empDelRes = await app.request(
      `http://local/api/attachments/${attachmentId}`,
      { method: "DELETE", headers: EMPLOYEE_HEADER },
      env
    );
    expect(empDelRes.status).toBe(403);

    // 2. Succès par un gestionnaire (204)
    const mgrDelRes = await app.request(
      `http://local/api/attachments/${attachmentId}`,
      { method: "DELETE", headers: MANAGER_HEADER },
      env
    );
    expect(mgrDelRes.status).toBe(204);

    // 3. Ne doit plus être téléchargeable (404)
    const downloadRes = await app.request(
      `http://local/api/attachments/${attachmentId}`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(downloadRes.status).toBe(404);
  });
});
