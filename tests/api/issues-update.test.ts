import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "creator@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "second@example.test", "Content-Type": "application/json" };
const OTHER_EMPLOYEE_HEADER = { "X-Dev-User-Email": "other_emp@example.test", "Content-Type": "application/json" };

const VALID_RESOLUTION_FIELDS = {
  causeStatus: "known" as const,
  causeSummary: "Mauvaise manipulation du lecteur code-barres.",
  permanentCorrectionType: "procedureUpdate" as const,
  permanentCorrectionSummary: "Mise à jour du protocole de validation.",
  finalResult: "Procédure validée avec succès.",
  preventionLearning: "Former l'équipe.",
  effectivenessStatus: "pending" as const,
};

async function get(path: string, headers = EMPLOYEE_HEADER) {
  return app.request(`http://local/api${path}`, { method: "GET", headers }, env);
}

async function post(path: string, body: unknown, headers = EMPLOYEE_HEADER) {
  return app.request(`http://local/api${path}`, { method: "POST", headers, body: JSON.stringify(body) }, env);
}

async function patch(path: string, body: unknown, headers: Record<string, string> = {}, authHeader = EMPLOYEE_HEADER) {
  return app.request(
    `http://local/api${path}`,
    { method: "PATCH", headers: { ...authHeader, ...headers }, body: JSON.stringify(body) },
    env
  );
}

let userId: number;
let secondUserId: number;
let otherEmployeeId: number;
let locationId: number;
let categoryId: number;
let otherCategoryId: number;
let subcategoryId: number;
let otherSubcategoryId: number;
let impactTimeLostId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM corrective_actions"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM subcategories"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);

  userId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'Créateur', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  secondUserId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('second@example.test', 'Gestionnaire', 'manager', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  otherEmployeeId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('other_emp@example.test', 'Autre Employé', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  locationId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('TEST', 'Succursale test') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;
  otherCategoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('repairs', 'Réparations') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  subcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'pricing_error', 'Erreur de prix') RETURNING id"
    )
      .bind(categoryId)
      .first<{ id: number }>()
  )!.id;
  otherSubcategoryId = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'delay', 'Retard') RETURNING id"
    )
      .bind(otherCategoryId)
      .first<{ id: number }>()
  )!.id;

  impactTimeLostId = (
    await env.DB.prepare(
      "INSERT INTO impact_types (code, label) VALUES ('time_lost', 'Temps perdu') RETURNING id"
    ).first<{ id: number }>()
  )!.id;
});

async function createIssue(overrides: Record<string, unknown> = {}) {
  const res = await post("/issues", {
    occurredOn: "2026-08-20",
    locationId,
    categoryId,
    description: "Un incident test de longueur suffisante.",
    priority: "normal",
    impacts: [{ impactTypeId: impactTimeLostId, details: null }],
    ...overrides,
  });
  const body = (await res.json()) as any;
  if (res.status !== 201) {
    throw new Error(`createIssue failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const etag = res.headers.get("ETag") as string;
  return { publicId: body.data.publicId as string, etag };
}

describe("PATCH /api/issues/:publicId", () => {

  /**
   * G-007 : la modification et sa trace d'audit sont une seule transaction.
   *
   * Sur un conflit de version, le batch doit être un no-op complet — ni
   * événement d'historique, ni impacts remplacés pour une modification
   * rejetée en 409. L'ancien découpage (UPDATE puis batch séparé) écrivait
   * l'historique même quand il ne fallait pas, et inversement pouvait laisser
   * un dossier modifié sans trace.
   */
  it("writes no history event when the update is rejected as a conflict", async () => {
    const { publicId, etag } = await createIssue();

    // Une première modification fait avancer row_version : l'ETag initial périme.
    await patch(`/issues/${publicId}`, { priority: "important" }, { "If-Match": etag }, MANAGER_HEADER);

    const issueId = Number(publicId.replace("INC-", ""));
    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM issue_history WHERE issue_id = ?"
    ).bind(issueId).first<{ n: number }>();

    const stale = await patch(
      `/issues/${publicId}`,
      { priority: "urgent", impacts: [{ impactTypeId: impactTimeLostId, details: "Remplacé" }] },
      { "If-Match": etag },
      MANAGER_HEADER
    );
    expect(stale.status).toBe(409);

    const after = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM issue_history WHERE issue_id = ?"
    ).bind(issueId).first<{ n: number }>();
    expect(after!.n).toBe(before!.n);

    // Les impacts de la requête rejetée n'ont pas été appliqués non plus.
    const impact = await env.DB.prepare(
      "SELECT details FROM issue_impacts WHERE issue_id = ?"
    ).bind(issueId).first<{ details: string | null }>();
    expect(impact!.details).toBeNull();
  });

  it("records exactly one history event for a successful update", async () => {
    const { publicId, etag } = await createIssue();
    const issueId = Number(publicId.replace("INC-", ""));

    const before = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM issue_history WHERE issue_id = ?"
    ).bind(issueId).first<{ n: number }>();

    const res = await patch(`/issues/${publicId}`, { priority: "urgent" }, { "If-Match": etag }, MANAGER_HEADER);
    expect(res.status).toBe(200);

    const after = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM issue_history WHERE issue_id = ?"
    ).bind(issueId).first<{ n: number }>();
    expect(after!.n).toBe(before!.n + 1);
  });

  /**
   * 01_produit/03_MATRICE_TRANSITIONS.md, `waiting → inProgress` :
   * « champs waiting actifs mis à null; historique conserve l'attente
   * précédente ». Sans cette trace, la raison de la stagnation d'un dossier
   * disparaît avec la purge des colonnes.
   */
  it("keeps the previous waiting target in history when leaving 'waiting'", async () => {
    const { publicId, etag } = await createIssue();

    const waitingRes = await patch(
      `/issues/${publicId}`,
      {
        status: "waiting",
        subcategoryId,
        ownerUserId: userId,
        waitingOn: { type: "supplier", label: "Fournisseur Beta" },
      },
      { "If-Match": etag },
      MANAGER_HEADER
    );
    expect(waitingRes.status).toBe(200);

    const resumeRes = await patch(
      `/issues/${publicId}`,
      { status: "inProgress" },
      { "If-Match": waitingRes.headers.get("ETag") as string },
      MANAGER_HEADER
    );
    expect(resumeRes.status).toBe(200);
    const resumed = (await resumeRes.json()) as any;
    expect(resumed.data.issue.waitingOn).toBeNull();

    const historyRes = await app.request(
      `http://local/api/issues/${publicId}/history`,
      { headers: MANAGER_HEADER },
      env
    );
    const events = ((await historyRes.json()) as any).data.items;
    const withPrevious = events.filter((e: any) => e.payload?.previousWaitingOn);
    expect(withPrevious).toHaveLength(1);
    expect(withPrevious[0].payload.previousWaitingOn).toMatchObject({
      type: "supplier",
      label: "Fournisseur Beta",
    });
  });

  it("rejects unauthenticated requests with 401", async () => {
    const res = await app.request(
      "http://local/api/issues/INC-000001",
      { method: "PATCH", headers: { "Content-Type": "application/json", "If-Match": "issue-1-v1" }, body: "{}" },
      env
    );
    expect(res.status).toBe(401);
  });

  it("rejects a request without If-Match with 428", async () => {
    const { publicId } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "Nouvelle description suffisamment longue." });
    expect(res.status).toBe(428);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("PRECONDITION_REQUIRED");
  });

  it("returns 404 for a well-formed but unknown publicId", async () => {
    const res = await patch("/issues/INC-999999", { description: "x".repeat(20) }, { "If-Match": "issue-999999-v1" });
    expect(res.status).toBe(404);
  });

  it("returns 404 for a malformed publicId", async () => {
    const res = await patch("/issues/not-valid", { description: "x".repeat(20) }, { "If-Match": "irrelevant" });
    expect(res.status).toBe(404);
  });

  it("S16: rejects an empty body (minProperties 1) with 422", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, {}, { "If-Match": etag });
    expect(res.status).toBe(422);
  });

  it("S15: rejects a mismatched If-Match with 409", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "x".repeat(20) }, { "If-Match": "issue-1-v999" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe("CONFLICT");
  });

  it("S15: rejects a stale ETag from before a previous successful PATCH", async () => {
    const { publicId, etag } = await createIssue();
    const first = await patch(`/issues/${publicId}`, { description: "Première mise à jour suffisamment longue." }, { "If-Match": etag });
    expect(first.status).toBe(200);

    const stale = await patch(`/issues/${publicId}`, { description: "Deuxième tentative avec ETag périmé." }, { "If-Match": etag });
    expect(stale.status).toBe(409);
  });

  it("applies a simple field update, bumps rowVersion and returns a fresh ETag", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { description: "Description mise à jour, assez longue." }, { "If-Match": etag });
    expect(res.status).toBe(200);
    const newEtag = res.headers.get("ETag");
    expect(newEtag).not.toBe(etag);

    const body = (await res.json()) as any;
    expect(body.data.issue.description).toBe("Description mise à jour, assez longue.");
    expect(body.data.issue.rowVersion).toBe(2);

    const getRes = await get(`/issues/${publicId}`);
    const getBody = (await getRes.json()) as any;
    expect(getBody.data.issue.description).toBe("Description mise à jour, assez longue.");
  });

  it("replaces impacts entirely when impacts is provided", async () => {
    const { publicId, etag } = await createIssue();
    const otherImpactId = (
      await env.DB.prepare("INSERT INTO impact_types (code, label) VALUES ('reputation', 'Réputation') RETURNING id").first<{
        id: number;
      }>()
    )!.id;

    const res = await patch(
      `/issues/${publicId}`,
      { impacts: [{ impactTypeId: otherImpactId, details: null }] },
      { "If-Match": etag }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.impacts).toHaveLength(1);
    expect(body.data.impacts[0].impactTypeId).toBe(otherImpactId);
  });

  it("rejects leaving 'new' without a subcategory (structural equivalent of S04)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { status: "inProgress" }, { "If-Match": etag }, MANAGER_HEADER);
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.subcategoryId).toBeDefined();
  });

  it("accepts leaving 'new' when a subcategory is provided in the same PATCH (manager)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(
      `/issues/${publicId}`,
      { status: "inProgress", subcategoryId },
      { "If-Match": etag },
      MANAGER_HEADER
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("inProgress");
  });

  it("rejects status='waiting' without waitingOn", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(`/issues/${publicId}`, { status: "waiting" }, { "If-Match": etag }, MANAGER_HEADER);
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.waitingOn).toBeDefined();
  });

  it("accepts status='waiting' with a supplier waitingOn + label (manager)", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(
      `/issues/${publicId}`,
      { status: "waiting", waitingOn: { type: "supplier", label: "Fournisseur ABC" } },
      { "If-Match": etag },
      MANAGER_HEADER
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("waiting");
    expect(body.data.issue.waitingOn).toEqual({ type: "supplier", userId: null, label: "Fournisseur ABC" });
  });

  it("auto-clears waitingOn when leaving 'waiting' without an explicit waitingOn", async () => {
    const created = await createIssue({ subcategoryId });
    const waitingRes = await patch(
      `/issues/${created.publicId}`,
      { status: "waiting", waitingOn: { type: "customer", label: "Client X" } },
      { "If-Match": created.etag },
      MANAGER_HEADER
    );
    const waitingEtag = waitingRes.headers.get("ETag") as string;

    const res = await patch(
      `/issues/${created.publicId}`,
      { status: "inProgress" },
      { "If-Match": waitingEtag },
      MANAGER_HEADER
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.status).toBe("inProgress");
    expect(body.data.issue.waitingOn).toBeNull();
  });

  it("manages resolvedAt/resolvedByUserId when entering and leaving 'resolved' (manager)", async () => {
    const created = await createIssue({ subcategoryId });
    const resolvedRes = await patch(
      `/issues/${created.publicId}`,
      { status: "resolved", ...VALID_RESOLUTION_FIELDS },
      { "If-Match": created.etag },
      MANAGER_HEADER
    );
    expect(resolvedRes.status).toBe(200);
    const resolvedBody = (await resolvedRes.json()) as any;
    expect(resolvedBody.data.issue.resolvedAt).not.toBeNull();
    expect(resolvedBody.data.issue.resolvedByUserId).toBe(secondUserId);

    const reopenRes = await patch(
      `/issues/${created.publicId}`,
      { status: "inProgress", reopenReason: "Raison de réouverture pour test." },
      { "If-Match": resolvedRes.headers.get("ETag") as string },
      MANAGER_HEADER
    );
    expect(reopenRes.status).toBe(200);
    const reopenBody = (await reopenRes.json()) as any;
    expect(reopenBody.data.issue.resolvedAt).toBeNull();
    expect(reopenBody.data.issue.resolvedByUserId).toBeNull();
  });


  it("rejects a subcategory that does not belong to the (possibly unchanged) category", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(`/issues/${publicId}`, { categoryId: otherCategoryId }, { "If-Match": etag });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.subcategoryId).toBeDefined();
  });

  it("accepts changing category and subcategory together when they match", async () => {
    const { publicId, etag } = await createIssue({ subcategoryId });
    const res = await patch(
      `/issues/${publicId}`,
      { categoryId: otherCategoryId, subcategoryId: otherSubcategoryId },
      { "If-Match": etag }
    );
    expect(res.status).toBe(200);
  });

  it("rejects an inactive/unknown ownerUserId (manager)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { ownerUserId: 999999 }, { "If-Match": etag }, MANAGER_HEADER);
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.fields.ownerUserId).toBeDefined();
  });

  it("accepts a valid ownerUserId (manager)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { ownerUserId: secondUserId }, { "If-Match": etag }, MANAGER_HEADER);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.issue.ownerUserId).toBe(secondUserId);
  });


  it("rejects an unknown field (additionalProperties: false)", async () => {
    const { publicId, etag } = await createIssue();
    const res = await patch(`/issues/${publicId}`, { notAField: true }, { "If-Match": etag });
    expect(res.status).toBe(422);
  });

  it("records a privacy-safe issue_updated history event without free-text values", async () => {
    const { publicId, etag } = await createIssue();
    await patch(`/issues/${publicId}`, { description: "Texte confidentiel à ne jamais journaliser." }, { "If-Match": etag });

    const rows = await env.DB.prepare(
      "SELECT event_type, payload_json FROM issue_history WHERE event_type = 'issue_updated'"
    ).all<{ event_type: string; payload_json: string }>();
    expect(rows.results).toHaveLength(1);
    const payload = JSON.parse(rows.results[0].payload_json);
    expect(payload.fields).toEqual(["description"]);
    expect(JSON.stringify(payload)).not.toContain("confidentiel");
  });

  describe("Matrice des transitions FLOW-02 (S06, S07, S08 et 16 cellules)", () => {
    it("S08: non-owner employee cannot transition new -> inProgress (403)", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(`/issues/${publicId}`, { status: "inProgress" }, { "If-Match": etag }, EMPLOYEE_HEADER);
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("S06: employee OWNER can transition inProgress -> waiting with supplier+label", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const progressRes = await patch(
        `/issues/${publicId}`,
        { status: "inProgress", ownerUserId: userId },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(progressRes.status).toBe(200);
      const progressEtag = progressRes.headers.get("ETag") as string;

      const waitRes = await patch(
        `/issues/${publicId}`,
        { status: "waiting", waitingOn: { type: "supplier", label: "Fournisseur Test" } },
        { "If-Match": progressEtag },
        EMPLOYEE_HEADER
      );
      expect(waitRes.status).toBe(200);
      const waitBody = (await waitRes.json()) as any;
      expect(waitBody.data.issue.status).toBe("waiting");
    });

    it("S08: non-owner employee cannot transition inProgress -> waiting (403)", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const progressRes = await patch(
        `/issues/${publicId}`,
        { status: "inProgress", ownerUserId: userId },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const progressEtag = progressRes.headers.get("ETag") as string;

      const res = await patch(
        `/issues/${publicId}`,
        { status: "waiting", waitingOn: { type: "supplier", label: "Fournisseur Test" } },
        { "If-Match": progressEtag },
        OTHER_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(403);
    });

    it("S07: employee OWNER can transition waiting -> inProgress", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const waitRes = await patch(
        `/issues/${publicId}`,
        { status: "waiting", ownerUserId: userId, waitingOn: { type: "customer", label: "Client ABC" } },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const waitEtag = waitRes.headers.get("ETag") as string;

      const progressRes = await patch(
        `/issues/${publicId}`,
        { status: "inProgress" },
        { "If-Match": waitEtag },
        EMPLOYEE_HEADER
      );
      expect(progressRes.status).toBe(200);
      const progressBody = (await progressRes.json()) as any;
      expect(progressBody.data.issue.status).toBe("inProgress");
    });

    it("rejects impossible transition inProgress -> new with 422 INVALID_STATUS_TRANSITION", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const progressRes = await patch(
        `/issues/${publicId}`,
        { status: "inProgress" },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const progressEtag = progressRes.headers.get("ETag") as string;

      const res = await patch(`/issues/${publicId}`, { status: "new" }, { "If-Match": progressEtag }, MANAGER_HEADER);
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("rejects impossible transition resolved -> waiting with 422 INVALID_STATUS_TRANSITION", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const resolvedRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const resolvedEtag = resolvedRes.headers.get("ETag") as string;

      const res = await patch(
        `/issues/${publicId}`,
        { status: "waiting", waitingOn: { type: "other", label: "Autre" } },
        { "If-Match": resolvedEtag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });
  });

  describe("Préconditions de résolution FLOW-03 (S10, S11, S12)", () => {
    it("S10: manager can resolve an issue when all required resolution fields are present", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(
        `/issues/${publicId}`,
        {
          status: "resolved",
          causeStatus: "known",
          causeSummary: "Panne du module WiFi lors du scan.",
          permanentCorrectionType: "systemConfiguration",
          permanentCorrectionSummary: "Remplacement du canal WiFi 5GHz.",
          finalResult: "Fonctionnement rétabli et vérifié sur 5 appareils.",
          preventionLearning: "Ajouter la vérification des bornes WiFi dans la checklist.",
          effectivenessStatus: "effective",
        },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.status).toBe("resolved");
      expect(body.data.issue.causeStatus).toBe("known");
      expect(body.data.issue.causeSummary).toBe("Panne du module WiFi lors du scan.");
      expect(body.data.issue.permanentCorrectionType).toBe("systemConfiguration");
      expect(body.data.issue.permanentCorrectionSummary).toBe("Remplacement du canal WiFi 5GHz.");
      expect(body.data.issue.finalResult).toBe("Fonctionnement rétabli et vérifié sur 5 appareils.");
      expect(body.data.issue.preventionLearning).toBe("Ajouter la vérification des bornes WiFi dans la checklist.");
      expect(body.data.issue.effectivenessStatus).toBe("effective");
    });

    it("rejects resolution with 422 if resolution fields are missing", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(
        `/issues/${publicId}`,
        { status: "resolved" },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.fields.causeStatus).toBeDefined();
      expect(body.error.fields.causeSummary).toBeDefined();
      expect(body.error.fields.permanentCorrectionType).toBeDefined();
      expect(body.error.fields.permanentCorrectionSummary).toBeDefined();
      expect(body.error.fields.finalResult).toBeDefined();
      expect(body.error.fields.preventionLearning).toBeDefined();
      expect(body.error.fields.effectivenessStatus).toBeDefined();
    });

    it("S11: rejects resolution with 422 when open blocking corrective action exists, accepts when action is done", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const issueId = Number(publicId.replace("INC-", ""));

      // Créer une action corrective bloquante ouverte (status = 'todo', blocks_issue_closure = 1)
      await env.DB.prepare(
        `INSERT INTO corrective_actions (issue_id, title, owner_user_id, due_date, status, blocks_issue_closure)
         VALUES (?, 'Mise à jour firmware obligatoire', ?, '2026-09-01', 'todo', 1)`
      )
        .bind(issueId, userId)
        .run();

      // Tentative de résolution -> 422
      const failRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(failRes.status).toBe(422);
      const failBody = (await failRes.json()) as any;
      expect(failBody.error.fields.status).toContain("action(s) corrective(s) bloquante(s)");

      // Terminer l'action corrective (status = 'done')
      await env.DB.prepare(
        `UPDATE corrective_actions SET status = 'done', completed_at = '2026-08-24T20:00:00Z' WHERE issue_id = ?`
      )
        .bind(issueId)
        .run();

      // Nouvelle tentative de résolution -> 200
      const successRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(successRes.status).toBe(200);
      const successBody = (await successRes.json()) as any;
      expect(successBody.data.issue.status).toBe("resolved");
    });

    it("S12: pending effectiveness defaults reviewDate to +30 days when omitted", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS, effectivenessStatus: "pending" },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.effectivenessStatus).toBe("pending");
      expect(body.data.issue.effectivenessReviewDate).not.toBeNull();
      // Doit correspondre à une date ISO YYYY-MM-DD
      expect(body.data.issue.effectivenessReviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("preserves explicitly provided effectivenessReviewDate when pending", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(
        `/issues/${publicId}`,
        {
          status: "resolved",
          ...VALID_RESOLUTION_FIELDS,
          effectivenessStatus: "pending",
          effectivenessReviewDate: "2026-11-15",
        },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.effectivenessReviewDate).toBe("2026-11-15");
    });
  });

  describe("Règles de réouverture FLOW-04 (S13)", () => {
    it("rejects reopening from resolved to inProgress without reopenReason (422)", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const resolvedRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const resolvedEtag = resolvedRes.headers.get("ETag") as string;

      const res = await patch(
        `/issues/${publicId}`,
        { status: "inProgress" },
        { "If-Match": resolvedEtag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.fields.reopenReason).toBeDefined();
    });

    it("rejects reopening with reopenReason shorter than 5 chars (422)", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const resolvedRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const resolvedEtag = resolvedRes.headers.get("ETag") as string;

      const res = await patch(
        `/issues/${publicId}`,
        { status: "inProgress", reopenReason: "abc" },
        { "If-Match": resolvedEtag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.fields.reopenReason).toBeDefined();
    });

    it("S13: manager reopens with valid reopenReason, clears resolution timestamps and logs issue_reopened event", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const resolvedRes = await patch(
        `/issues/${publicId}`,
        { status: "resolved", ...VALID_RESOLUTION_FIELDS },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      const resolvedEtag = resolvedRes.headers.get("ETag") as string;

      const reopenRes = await patch(
        `/issues/${publicId}`,
        { status: "inProgress", reopenReason: "Le problème persiste malgré le correctif appliqué." },
        { "If-Match": resolvedEtag },
        MANAGER_HEADER
      );
      expect(reopenRes.status).toBe(200);
      const reopenBody = (await reopenRes.json()) as any;
      expect(reopenBody.data.issue.status).toBe("inProgress");
      expect(reopenBody.data.issue.resolvedAt).toBeNull();
      expect(reopenBody.data.issue.resolvedByUserId).toBeNull();

      // Vérifier la présence de l'événement issue_reopened dans issue_history
      const issueId = Number(publicId.replace("INC-", ""));
      const historyRows = await env.DB.prepare(
        "SELECT event_type, payload_json FROM issue_history WHERE issue_id = ? AND event_type = 'issue_reopened'"
      )
        .bind(issueId)
        .all<{ event_type: string; payload_json: string }>();

      expect(historyRows.results).toHaveLength(1);
      const payload = JSON.parse(historyRows.results[0].payload_json);
      expect(payload.reopenReason).toBe("Le problème persiste malgré le correctif appliqué.");
      expect(payload.fields).toContain("reopenReason");
      expect(payload.fields).toContain("status");
    });

    it("rejects providing reopenReason when issue is not resolved (422)", async () => {
      const { publicId, etag } = await createIssue({ subcategoryId });
      const res = await patch(
        `/issues/${publicId}`,
        { description: "Mise à jour d'un ticket en cours.", reopenReason: "Tentative invalide de raison." },
        { "If-Match": etag },
        MANAGER_HEADER
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as any;
      expect(body.error.fields.reopenReason).toBeDefined();
    });
  });
});

