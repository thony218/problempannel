import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";
import { toPublicId } from "../../worker/domain/publicId";

const DEV_HEADER = { "X-Dev-User-Email": "creator@example.test" };

async function get(path: string, headers: HeadersInit = DEV_HEADER) {
  return app.request(`http://local/api${path}`, { method: "GET", headers }, env);
}

let userId1: number;
let userId2: number;
let locationId1: number;
let locationId2: number;
let deptId1: number;
let catId1: number;
let catId2: number;
let subcatId1: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM issue_impacts"),
    env.DB.prepare("DELETE FROM issues"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM subcategories"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM departments"),
    env.DB.prepare("DELETE FROM locations"),
    env.DB.prepare("DELETE FROM impact_types"),
    env.DB.prepare("DELETE FROM sqlite_sequence"),
  ]);

  userId1 = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('creator@example.test', 'User Un', 'manager', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  userId2 = (
    await env.DB.prepare(
      "INSERT INTO users (email, display_name, role, active) VALUES ('other@example.test', 'User Deux', 'employee', 1) RETURNING id"
    ).first<{ id: number }>()
  )!.id;

  locationId1 = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('MTL', 'Montréal') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  locationId2 = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('QUE', 'Québec') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  deptId1 = (
    await env.DB.prepare("INSERT INTO departments (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  catId1 = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('billing', 'Facturation') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  catId2 = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('delivery', 'Livraison') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  subcatId1 = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'wrong_price', 'Erreur de prix') RETURNING id"
    )
      .bind(catId1)
      .first<{ id: number }>()
  )!.id;
});

describe("GET /api/issues", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await get("/issues", {} as Record<string, string>);
    expect(res.status).toBe(401);
  });

  it("returns empty list when no issues exist", async () => {
    const res = await get("/issues");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      items: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("paginates issues with opaque cursor and limit", async () => {
    // Insérer 5 issues
    const ids: number[] = [];
    for (let i = 1; i <= 5; i++) {
      const row = await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
         VALUES ('2026-08-20', ?, ?, ?, ?, 'normal', 'new') RETURNING id`
      )
        .bind(userId1, locationId1, catId1, `Description du dossier numéro ${i}`)
        .first<{ id: number }>();
      ids.push(row!.id);
    }

    // Page 1 : limit = 2
    const res1 = await get("/issues?limit=2");
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as any;
    expect(body1.data.items).toHaveLength(2);
    expect(body1.data.hasMore).toBe(true);
    expect(body1.data.nextCursor).toBeTruthy();
    expect(body1.data.items[0].publicId).toBe(toPublicId(ids[4]));
    expect(body1.data.items[1].publicId).toBe(toPublicId(ids[3]));

    // Page 2 : avec cursor de page 1
    const res2 = await get(`/issues?limit=2&cursor=${encodeURIComponent(body1.data.nextCursor)}`);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as any;
    expect(body2.data.items).toHaveLength(2);
    expect(body2.data.hasMore).toBe(true);
    expect(body2.data.nextCursor).toBeTruthy();
    expect(body2.data.items[0].publicId).toBe(toPublicId(ids[2]));
    expect(body2.data.items[1].publicId).toBe(toPublicId(ids[1]));

    // Page 3 : dernier élément restant
    const res3 = await get(`/issues?limit=2&cursor=${encodeURIComponent(body2.data.nextCursor)}`);
    expect(res3.status).toBe(200);
    const body3 = (await res3.json()) as any;
    expect(body3.data.items).toHaveLength(1);
    expect(body3.data.hasMore).toBe(false);
    expect(body3.data.nextCursor).toBeNull();
    expect(body3.data.items[0].publicId).toBe(toPublicId(ids[0]));
  });

  it("rejects invalid cursor with 422 VALIDATION_ERROR", async () => {
    const res = await get("/issues?cursor=invalid_base64_cursor!");
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("filters by status (single and multiple values)", async () => {
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, ?, 'Issue new', 'normal', 'new')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, ?, 'Issue inProgress', 'normal', 'in_progress')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, ?, 'Issue resolved', 'normal', 'resolved')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    // Filtre simple
    const resSingle = await get("/issues?status=new");
    const bodySingle = (await resSingle.json()) as any;
    expect(bodySingle.data.items).toHaveLength(1);
    expect(bodySingle.data.items[0].status).toBe("new");

    // Filtre multiple
    const resMulti = await get("/issues?status=new&status=inProgress");
    const bodyMulti = (await resMulti.json()) as any;
    expect(bodyMulti.data.items).toHaveLength(2);
    const statuses = bodyMulti.data.items.map((i: any) => i.status);
    expect(statuses).toContain("new");
    expect(statuses).toContain("inProgress");
    expect(statuses).not.toContain("resolved");
  });

  it("filters by priority", async () => {
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, 'Urgent issue', 'urgent', 'new')`
    )
      .bind(userId1, locationId1, catId1)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, 'Normal issue', 'normal', 'new')`
    )
      .bind(userId1, locationId1, catId1)
      .run();

    const res = await get("/issues?priority=urgent");
    const body = (await res.json()) as any;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].priority).toBe("urgent");
  });

  it("filters by locationId, departmentId, categoryId and ownerUserId", async () => {
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, department_id, category_id, subcategory_id, owner_user_id, error_actor_user_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, ?, ?, ?, ?, ?, 'Cible exacte', 'normal', 'new')`
    )
      .bind(userId1, locationId1, deptId1, catId1, subcatId1, userId2, userId2)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, department_id, category_id, subcategory_id, owner_user_id, description, priority, status)
       VALUES ('2026-08-20', ?, ?, NULL, ?, NULL, NULL, 'Autre issue', 'normal', 'new')`
    )
      .bind(userId1, locationId2, catId2)
      .run();

    const resLoc = await get(`/issues?locationId=${locationId1}`);
    expect(((await resLoc.json()) as any).data.items).toHaveLength(1);

    const resDept = await get(`/issues?departmentId=${deptId1}`);
    expect(((await resDept.json()) as any).data.items).toHaveLength(1);

    const resCat = await get(`/issues?categoryId=${catId1}`);
    expect(((await resCat.json()) as any).data.items).toHaveLength(1);

    const resOwner = await get(`/issues?ownerUserId=${userId2}`);
    expect(((await resOwner.json()) as any).data.items).toHaveLength(1);

    const resErrorActor = await get(`/issues?errorActorUserId=${userId2}`);
    const errorActorBody = (await resErrorActor.json()) as any;
    expect(errorActorBody.data.items).toHaveLength(1);
    expect(errorActorBody.data.items[0].errorActorUserId).toBe(userId2);

    const resDiff = await get(`/issues?locationId=${locationId2}&categoryId=${catId1}`);
    expect(((await resDiff.json()) as any).data.items).toHaveLength(0);
  });

  it("sorts oldest, priority and due date with stable cursor pagination", async () => {
    const inserted: number[] = [];
    for (const [priority, dueDate] of [
      ["normal", "2026-09-10"],
      ["urgent", null],
      ["important", "2026-08-30"],
      ["urgent", "2026-08-20"],
    ] as const) {
      const row = await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status, due_date)
         VALUES ('2026-08-20', ?, ?, ?, 'Tri stable', ?, 'new', ?) RETURNING id`
      ).bind(userId1, locationId1, catId1, priority, dueDate).first<{ id: number }>();
      inserted.push(row!.id);
    }

    const oldest = (await (await get("/issues?sort=oldest")).json()) as any;
    expect(oldest.data.items.map((item: any) => item.publicId)).toEqual(inserted.map(toPublicId));

    const priorityPage1 = (await (await get("/issues?sort=priority&limit=2")).json()) as any;
    expect(priorityPage1.data.items.map((item: any) => item.publicId)).toEqual([
      toPublicId(inserted[3]),
      toPublicId(inserted[1]),
    ]);
    const priorityPage2 = (await (
      await get(`/issues?sort=priority&limit=2&cursor=${encodeURIComponent(priorityPage1.data.nextCursor)}`)
    ).json()) as any;
    expect(priorityPage2.data.items.map((item: any) => item.publicId)).toEqual([
      toPublicId(inserted[2]),
      toPublicId(inserted[0]),
    ]);

    const due = (await (await get("/issues?sort=dueDate")).json()) as any;
    expect(due.data.items.map((item: any) => item.publicId)).toEqual([
      toPublicId(inserted[3]),
      toPublicId(inserted[2]),
      toPublicId(inserted[0]),
      toPublicId(inserted[1]),
    ]);
  });

  it("filters by date range (from / to)", async () => {
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
       VALUES ('2026-08-01', ?, ?, ?, 'Début du mois', 'normal', 'new')`
    )
      .bind(userId1, locationId1, catId1)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
       VALUES ('2026-08-15', ?, ?, ?, 'Milieu du mois', 'normal', 'new')`
    )
      .bind(userId1, locationId1, catId1)
      .run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
       VALUES ('2026-08-30', ?, ?, ?, 'Fin du mois', 'normal', 'new')`
    )
      .bind(userId1, locationId1, catId1)
      .run();

    const res = await get("/issues?from=2026-08-10&to=2026-08-20");
    const body = (await res.json()) as any;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].occurredOn).toBe("2026-08-15");
  });

  it("filters by overdue", async () => {
    // Dossier en retard (échéance passée, non résolu)
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, due_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'En retard', 'urgent', 'in_progress', '2020-01-01')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    // Dossier dans les temps
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, due_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'Pas en retard', 'normal', 'in_progress', '2099-01-01')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    // Dossier résolu (ne doit pas être compté en retard même avec date passée)
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, due_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'Déjà résolu', 'normal', 'resolved', '2020-01-01')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    const res = await get("/issues?overdue=true");
    const body = (await res.json()) as any;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].description).toBe("En retard");
  });

  it("filters by effectivenessReviewDueBefore", async () => {
    // Dossier résolu pending avec date de revue échue
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, effectiveness_review_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'Revue due', 'normal', 'resolved', 'pending', '2026-08-15')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    // Dossier résolu pending avec date de revue future
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, effectiveness_review_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'Revue future', 'normal', 'resolved', 'pending', '2026-09-15')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    // Dossier résolu mais efficacité déjà validée
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, effectiveness_review_date)
       VALUES ('2026-08-01', ?, ?, ?, ?, 'Revue effective', 'normal', 'resolved', 'effective', '2026-08-10')`
    )
      .bind(userId1, locationId1, catId1, subcatId1)
      .run();

    const res = await get("/issues?effectivenessReviewDueBefore=2026-08-20");
    const body = (await res.json()) as any;
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].description).toBe("Revue due");
  });

  describe("search q (LIST-03)", () => {
    it("searches by keyword with LIKE escaping", async () => {
      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
         VALUES ('2026-08-01', ?, ?, ?, 'Problème avec 100%_remise sur la facture', 'normal', 'new')`
      )
        .bind(userId1, locationId1, catId1)
        .run();

      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
         VALUES ('2026-08-01', ?, ?, ?, 'Problème avec 1000remise sans pourcentage', 'normal', 'new')`
      )
        .bind(userId1, locationId1, catId1)
        .run();

      // Recherche exacte avec % et _
      const res = await get("/issues?q=100%25_remise");
      const body = (await res.json()) as any;
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].description).toContain("100%_remise");
    });

    it("searches by publicId format INC-000001", async () => {
      const row1 = await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
         VALUES ('2026-08-01', ?, ?, ?, 'Premier dossier', 'normal', 'new') RETURNING id`
      )
        .bind(userId1, locationId1, catId1)
        .first<{ id: number }>();

      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, created_by_user_id, location_id, category_id, description, priority, status)
         VALUES ('2026-08-01', ?, ?, ?, 'Deuxième dossier', 'normal', 'new')`
      )
        .bind(userId1, locationId1, catId1)
        .run();

      const publicId = toPublicId(row1!.id);
      const res = await get(`/issues?q=${publicId}`);
      const body = (await res.json()) as any;
      expect(body.data.items).toHaveLength(1);
      expect(body.data.items[0].publicId).toBe(publicId);
    });

    it("rejects search q when shorter than 2 characters or longer than 40", async () => {
      const resShort = await get("/issues?q=a");
      expect(resShort.status).toBe(422);

      const resLong = await get(`/issues?q=${"a".repeat(41)}`);
      expect(resLong.status).toBe(422);
    });
  });

  describe("query parameters validation", () => {
    it("rejects invalid limit", async () => {
      const resZero = await get("/issues?limit=0");
      expect(resZero.status).toBe(422);

      const resHigh = await get("/issues?limit=101");
      expect(resHigh.status).toBe(422);
    });

    it("rejects invalid date format", async () => {
      const res = await get("/issues?from=invalid-date");
      expect(res.status).toBe(422);
    });

    it("rejects invalid status", async () => {
      const res = await get("/issues?status=unknown_status");
      expect(res.status).toBe(422);
    });
  });
});
