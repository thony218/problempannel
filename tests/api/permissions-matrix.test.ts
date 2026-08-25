import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const CREATOR_EMPLOYEE_HEADER = { "X-Dev-User-Email": "creator@example.test", "Content-Type": "application/json" };
const OTHER_EMPLOYEE_HEADER = { "X-Dev-User-Email": "other_emp@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test", "Content-Type": "application/json" };
const ADMIN_HEADER = { "X-Dev-User-Email": "admin@example.test", "Content-Type": "application/json" };

let creatorId: number;
let otherEmployeeId: number;
let managerId: number;
let adminId: number;
let locationId: number;
let categoryId: number;
let subcategoryId: number;
let impactId: number;

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

  creatorId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'Créateur', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  otherEmployeeId = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('other_emp@example.test', 'Autre Employé', 'employee', 1) RETURNING id"
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
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'pricing', 'Prix') RETURNING id"
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

async function createIssue(authHeader = CREATOR_EMPLOYEE_HEADER) {
  const res = await app.request(
    "http://local/api/issues",
    {
      method: "POST",
      headers: authHeader,
      body: JSON.stringify({
        occurredOn: "2026-08-20",
        locationId,
        categoryId,
        description: "Incident initial de test suffisamment long.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string, etag: res.headers.get("ETag") as string };
}

async function patchIssue(publicId: string, body: unknown, etag: string, authHeader: Record<string, string>) {
  return app.request(
    `http://local/api/issues/${publicId}`,
    {
      method: "PATCH",
      headers: { ...authHeader, "If-Match": etag },
      body: JSON.stringify(body),
    },
    env
  );
}

describe("QA-01: Matrice exhaustive des permissions par champ (01_produit/04_MATRICE_PERMISSIONS.md)", () => {
  describe("Rôle Employé — Correction de son issue au statut 'new'", () => {
    it("allows the creator employee to correct description, occurredOn, impacts while status='new'", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      const res = await patchIssue(
        publicId,
        { description: "Description corrigée par le créateur de l'issue." },
        etag,
        CREATOR_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.description).toBe("Description corrigée par le créateur de l'issue.");
    });

    it("rejects another employee trying to correct an issue created by someone else (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      const res = await patchIssue(
        publicId,
        { description: "Tentative de modification par un autre employé." },
        etag,
        OTHER_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("rejects an employee trying to correct description once issue has left 'new' (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      // Le manager passe l'issue à inProgress
      const progressRes = await patchIssue(
        publicId,
        { status: "inProgress", subcategoryId, ownerUserId: creatorId },
        etag,
        MANAGER_HEADER
      );
      const progressEtag = progressRes.headers.get("ETag") as string;

      // Le créateur tente de modifier la description alors que le statut est inProgress -> 403
      const res = await patchIssue(
        publicId,
        { description: "Tentative de modification tardive par l'employé." },
        progressEtag,
        CREATOR_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Rôle Employé — Champs réservés aux managers et admins", () => {
    it("rejects an employee trying to change priority (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);
      const res = await patchIssue(publicId, { priority: "urgent" }, etag, CREATOR_EMPLOYEE_HEADER);
      expect(res.status).toBe(403);
    });

    it("rejects an employee trying to assign ownerUserId (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);
      const res = await patchIssue(publicId, { ownerUserId: otherEmployeeId }, etag, CREATOR_EMPLOYEE_HEADER);
      expect(res.status).toBe(403);
    });

    it("rejects an employee trying to change dueDate (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);
      const res = await patchIssue(publicId, { dueDate: "2026-09-30" }, etag, CREATOR_EMPLOYEE_HEADER);
      expect(res.status).toBe(403);
    });

    it("rejects an employee trying to edit cause/correction fields (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);
      const res = await patchIssue(
        publicId,
        { causeStatus: "known", causeSummary: "Cause analysée." },
        etag,
        CREATOR_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(403);
    });

    it("rejects an employee trying to edit effectiveness fields (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);
      const res = await patchIssue(publicId, { effectivenessStatus: "effective" }, etag, CREATOR_EMPLOYEE_HEADER);
      expect(res.status).toBe(403);
    });
  });


  describe("Rôle Employé — Attente (waitingOn) réservée au responsable", () => {
    /**
     * Régression : un employé non-responsable ne doit pas pouvoir changer la
     * cible d'attente d'un dossier, y compris en joignant le statut courant à
     * sa requête (`status` inchangé = transition no-op).
     * Cf. 01_produit/03_MATRICE_TRANSITIONS.md §Préconditions → waiting.
     */
    it("rejects a non-owner employee changing waitingOn by replaying the current status (403)", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      // Le manager met le dossier en attente et désigne le créateur responsable.
      const waitingRes = await patchIssue(
        publicId,
        {
          status: "waiting",
          subcategoryId,
          ownerUserId: creatorId,
          waitingOn: { type: "supplier", label: "Fournisseur A" },
        },
        etag,
        MANAGER_HEADER
      );
      expect(waitingRes.status).toBe(200);
      const waitingEtag = waitingRes.headers.get("ETag") as string;

      // Un autre employé rejoue le statut courant pour glisser un waitingOn.
      const res = await patchIssue(
        publicId,
        { status: "waiting", waitingOn: { type: "supplier", label: "Fournisseur pirate" } },
        waitingEtag,
        OTHER_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe("FORBIDDEN");
    });

    it("allows the designated owner to update waitingOn", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      const waitingRes = await patchIssue(
        publicId,
        {
          status: "waiting",
          subcategoryId,
          ownerUserId: creatorId,
          waitingOn: { type: "supplier", label: "Fournisseur A" },
        },
        etag,
        MANAGER_HEADER
      );
      const waitingEtag = waitingRes.headers.get("ETag") as string;

      const res = await patchIssue(
        publicId,
        { waitingOn: { type: "supplier", label: "Fournisseur B" } },
        waitingEtag,
        CREATOR_EMPLOYEE_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.waitingOn.label).toBe("Fournisseur B");
    });
  });

  describe("Rôles Manager et Admin — Droits complets d'édition", () => {
    it("allows manager to change priority, ownerUserId, dueDate and cause details", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      const res = await patchIssue(
        publicId,
        {
          priority: "urgent",
          ownerUserId: otherEmployeeId,
          dueDate: "2026-09-15",
          causeStatus: "known",
          causeSummary: "Analyse effectuée par le gestionnaire.",
        },
        etag,
        MANAGER_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.priority).toBe("urgent");
      expect(body.data.issue.ownerUserId).toBe(otherEmployeeId);
      expect(body.data.issue.dueDate).toBe("2026-09-15");
      expect(body.data.issue.causeStatus).toBe("known");
    });

    it("allows admin to change any field", async () => {
      const { publicId, etag } = await createIssue(CREATOR_EMPLOYEE_HEADER);

      const res = await patchIssue(
        publicId,
        {
          priority: "important",
          ownerUserId: managerId,
          description: "Description ajustée par l'administrateur.",
        },
        etag,
        ADMIN_HEADER
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.issue.priority).toBe("important");
      expect(body.data.issue.description).toBe("Description ajustée par l'administrateur.");
    });
  });
});
