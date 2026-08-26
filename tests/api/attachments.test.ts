import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";
import { heicFile, heifFile, jpegFile } from "./support/fixtures";

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
    const file = jpegFile("img_11.jpg");
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

  it("S55: atomically caps concurrent uploads and removes the rejected R2 object", async () => {
    const { publicId } = await createIssue();
    const issueId = Number(publicId.replace("INC-", ""));

    for (let i = 1; i <= 9; i++) {
      await env.DB.prepare(
        `INSERT INTO attachments (issue_id, uploaded_by_user_id, original_name, content_type, size_bytes, r2_key)
         VALUES (?, ?, ?, 'image/jpeg', 100, ?)`
      )
        .bind(issueId, employeeId, `existing_${i}.jpg`, `existing_key_${i}`)
        .run();
    }

    // Le faux bucket R2 de Miniflare survit aux DELETE SQL du beforeEach.
    // Mesurer le delta isole donc les deux téléversements de cette course.
    const objectsBefore = await env.ATTACHMENTS.list({ prefix: `issues/${issueId}/` });

    const upload = (name: string) => {
      const formData = new FormData();
      formData.append("file", jpegFile(name, name));
      return app.request(
        `http://local/api/issues/${publicId}/attachments`,
        { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
        env
      );
    };

    const responses = await Promise.all([upload("race_a.jpg"), upload("race_b.jpg")]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);

    const activeCount = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM attachments WHERE issue_id = ? AND deleted_at IS NULL"
    )
      .bind(issueId)
      .first<{ count: number }>();
    expect(activeCount?.count).toBe(10);

    const storedObjects = await env.ATTACHMENTS.list({ prefix: `issues/${issueId}/` });
    expect(storedObjects.objects).toHaveLength(objectsBefore.objects.length + 1);
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
/**
   * Régression : un nom de fichier accentué ne doit pas être mutilé dans
   * `Content-Disposition`, et l'en-tête ne doit jamais contenir de CR/LF
   * (`Headers.set` lève dessus, ce qui transformerait un téléchargement en
   * 500). Vérifie aussi le durcissement de la réponse binaire, servie depuis
   * l'origine même de l'application.
   */
  it("serves downloads with hardened headers and an RFC 5987 filename", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "reçu été.jpg", {
      type: "image/jpeg",
    });
    formData.append("file", file);

    const uploadRes = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );
    expect(uploadRes.status).toBe(201);
    const attachmentId = ((await uploadRes.json()) as any).data.id;

    const downloadRes = await app.request(
      `http://local/api/attachments/${attachmentId}`,
      { headers: EMPLOYEE_HEADER },
      env
    );

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(downloadRes.headers.get("Content-Security-Policy")).toContain("sandbox");

    const disposition = downloadRes.headers.get("Content-Disposition") as string;
    expect(disposition).not.toMatch(/[\r\n]/);
    // Nom UTF-8 percent-encodé : les accents survivent au transport.
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain(encodeURIComponent("reçu"));
  });
/**
   * `File.type` est renseigné par le client. Un exécutable renommé `photo.jpg`
   * et annoncé `image/jpeg` franchissait le contrôle de type sans difficulté :
   * seule la lecture des octets d'en-tête permet au serveur de trancher.
   */
  it("rejects a file whose bytes do not match the declared type (415)", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    // Signature d'un exécutable Windows (MZ), présenté comme une photo.
    const disguised = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    formData.append("file", new File([disguised], "photo.jpg", { type: "image/jpeg" }));

    const res = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );

    expect(res.status).toBe(415);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(body.error.message).toContain("ne correspond pas");

    // Rien n'a été écrit : ni ligne en base, ni objet dans le bucket.
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM attachments").first<{ n: number }>();
    expect(rows!.n).toBe(0);
  });

  /**
   * S18 / S19 : HEIC et HEIF acceptés.
   *
   * `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md` §Pièces jointes impose
   * « HEIC/HEIF acceptés côté serveur » : c'est le format par défaut des
   * photos d'iPhone, donc le cas le plus fréquent d'une déclaration faite
   * depuis le terrain. Le contrôle de signature ajouté ensuite pouvait très
   * bien les rejeter sans qu'aucun test ne s'en aperçoive — la liste des
   * types autorisés était vérifiée, la reconnaissance des octets ne l'était
   * pas.
   */
  it("S18: accepts a genuine HEIC photo", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    formData.append("file", heicFile("iphone.heic"));

    const res = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.contentType).toBe("image/heic");
    expect(body.data.originalName).toBe("iphone.heic");
  });

  it("S19: accepts a genuine HEIF photo", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    formData.append("file", heifFile("iphone.heif"));

    const res = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );

    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.data.contentType).toBe("image/heif");
  });

  /**
   * Le conteneur ISO-BMFF ne sert pas qu'aux images : une vidéo MP4 commence
   * elle aussi par une boîte `ftyp`. Seules les marques d'image doivent
   * passer, sinon accepter le HEIC reviendrait à accepter tout MP4 renommé.
   */
  it("rejects an ISO-BMFF container whose brand is not an image", async () => {
    const { publicId } = await createIssue();

    const ascii = (text: string) => Array.from(text).map((c) => c.charCodeAt(0));
    const mp4 = new Uint8Array([
      0x00, 0x00, 0x00, 0x18,
      ...ascii("ftyp"),
      ...ascii("mp42"),
      0x00, 0x00, 0x00, 0x00,
      ...ascii("isom"),
    ]);

    const formData = new FormData();
    formData.append("file", new File([mp4], "video.heic", { type: "image/heic" }));

    const res = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );

    expect(res.status).toBe(415);
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM attachments").first<{ n: number }>();
    expect(rows!.n).toBe(0);
  });

  it("accepts a genuine PDF", async () => {
    const { publicId } = await createIssue();

    const formData = new FormData();
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
    formData.append("file", new File([pdf], "facture.pdf", { type: "application/pdf" }));

    const res = await app.request(
      `http://local/api/issues/${publicId}/attachments`,
      { method: "POST", headers: EMPLOYEE_HEADER, body: formData },
      env
    );

    expect(res.status).toBe(201);
  });
});
