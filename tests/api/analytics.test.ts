import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test", "Content-Type": "application/json" };

let employeeId: number;
let managerId: number;
let locationMtlId: number;
let locationQcId: number;
let categoryId: number;
let subcategory1Id: number;
let subcategory2Id: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
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

  locationMtlId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('MTL', 'Montréal') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  locationQcId = (
    await env.DB.prepare("INSERT INTO locations (code, label) VALUES ('QC', 'Québec') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  categoryId = (
    await env.DB.prepare("INSERT INTO categories (code, label) VALUES ('sales', 'Ventes') RETURNING id").first<{
      id: number;
    }>()
  )!.id;

  subcategory1Id = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'price_error', 'Erreur de prix') RETURNING id"
    )
      .bind(categoryId)
      .first<{ id: number }>()
  )!.id;

  subcategory2Id = (
    await env.DB.prepare(
      "INSERT INTO subcategories (category_id, code, label) VALUES (?, 'stock_error', 'Erreur de stock') RETURNING id"
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

describe("ANA-01..04: Endpoints Analytique et Récurrence", () => {
  it("S33: computes summary KPIs including averageResolutionHours = resolvedAt - createdAt (ANA-02)", async () => {
    // Insérer des dossiers avec différents statuts
    // 1. Ouvert urgent
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, description, priority, status, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, 'Incident 1', 'urgent', 'new', ?)`
    ).bind(locationMtlId, categoryId, employeeId).run();

    // 2. Ouvert en attente en retard
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, due_date, waiting_on_type, waiting_on_user_id, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Incident 2', 'normal', 'waiting', '2026-08-01', 'user', ?, ?)`
    ).bind(locationMtlId, categoryId, subcategory1Id, employeeId, employeeId).run();

    // 3. Résolu avec efficacité pending (créé il y a 2h)
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, created_at, resolved_at, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Incident 3', 'normal', 'resolved', 'pending', '2026-08-20T10:00:00.000Z', '2026-08-20T12:00:00.000Z', ?)`
    ).bind(locationMtlId, categoryId, subcategory1Id, employeeId).run();

    const res = await app.request("http://local/api/analytics/summary", { headers: EMPLOYEE_HEADER }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.data.open).toBe(2);
    expect(body.data.urgent).toBe(1);
    expect(body.data.overdue).toBe(1);
    expect(body.data.waiting).toBe(1);
    expect(body.data.resolved).toBe(1);
    expect(body.data.pendingEffectiveness).toBe(1);
    expect(body.data.averageResolutionHours).toBe(2);
  });

/**
   * Régression : « Dossier en retard » se calcule sur la date **métier**
   * (01_produit/08_DEFINITIONS_ANALYTIQUES.md), pas sur `date('now')` en UTC.
   *
   * Le cas discriminant est un dossier dû **aujourd'hui** : il n'est pas en
   * retard. Passé 19 h ou 20 h à Montréal, l'UTC est déjà au lendemain et un
   * calcul en UTC le déclarerait en retard — `/api/issues?overdue=true` et
   * `/api/analytics/summary` donneraient alors deux réponses contradictoires
   * sur le même dossier au même instant.
   */
  it("agrees with GET /issues?overdue=true on a file due today", async () => {
    const businessToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, description, priority, status, due_date, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, 'Dossier dû aujourd hui', 'normal', 'new', ?, ?)`
    ).bind(locationMtlId, categoryId, businessToday, employeeId).run();

    const listRes = await app.request("http://local/api/issues?overdue=true", { headers: EMPLOYEE_HEADER }, env);
    const listBody = (await listRes.json()) as any;

    const summaryRes = await app.request("http://local/api/analytics/summary", { headers: EMPLOYEE_HEADER }, env);
    const summaryBody = (await summaryRes.json()) as any;

    expect(summaryBody.data.overdue).toBe(listBody.data.items.length);
    expect(summaryBody.data.overdue).toBe(0);
  });

  it("S29, S30: detects local vs organizational recurrence groups with 3/90 threshold (ANA-03)", async () => {
    // Créer 3 dossiers dans location MTL pour subcategory1Id -> déclenche récurrence locale & organisationnelle
    for (let i = 1; i <= 3; i++) {
      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, created_by_user_id)
         VALUES ('2026-08-20', ?, ?, ?, ?, 'normal', 'new', ?)`
      ).bind(locationMtlId, categoryId, subcategory1Id, `Erreur MTL ${i}`, employeeId).run();
    }

    // Créer 2 dossiers dans location QC pour subcategory2Id et 1 dans location MTL pour subcategory2Id
    // -> Pas de récurrence locale (2 et 1 < 3), mais déclenche récurrence organisationnelle (total 3) !
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Erreur QC 1', 'normal', 'new', ?)`
    ).bind(locationQcId, categoryId, subcategory2Id, employeeId).run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Erreur QC 2', 'normal', 'new', ?)`
    ).bind(locationQcId, categoryId, subcategory2Id, employeeId).run();

    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Erreur MTL 1 pour subcat 2', 'normal', 'new', ?)`
    ).bind(locationMtlId, categoryId, subcategory2Id, employeeId).run();

    const res = await app.request("http://local/api/analytics/recurring", { headers: EMPLOYEE_HEADER }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    const localGroups = body.data.filter((g: any) => g.scope === "location");
    const orgGroups = body.data.filter((g: any) => g.scope === "organization");

    // Récurrence locale : uniquement subcategory1Id à Montréal (count = 3)
    expect(localGroups).toHaveLength(1);
    expect(localGroups[0].subcategoryId).toBe(subcategory1Id);
    expect(localGroups[0].locationId).toBe(locationMtlId);
    expect(localGroups[0].count).toBe(3);

    // Récurrence organisationnelle : subcategory1Id (3) et subcategory2Id (3)
    expect(orgGroups).toHaveLength(2);
    expect(orgGroups.map((g: any) => g.subcategoryId)).toContain(subcategory1Id);
    expect(orgGroups.map((g: any) => g.subcategoryId)).toContain(subcategory2Id);
  });

  /**
   * S31 : « 5 catégories sans sous-cat ne sont pas récurrentes — mais ne
   * peuvent sortir new ».
   *
   * `01_produit/08_DEFINITIONS_ANALYTIQUES.md` groupe la récurrence sur
   * `subcategory_id`, jamais sur la catégorie. Cinq déclarations dans la même
   * catégorie, toutes sans sous-catégorie, ne constituent donc pas une
   * récurrence : elles ne sont pas encore qualifiées.
   *
   * Le scénario tient en deux moitiés indissociables. Si seule la première
   * était vraie, ces dossiers resteraient invisibles pour toujours — le
   * tableau de bord ignorerait une répétition réelle. La seconde est ce qui
   * l'empêche : aucun de ces dossiers ne peut quitter `new` sans qu'un
   * gestionnaire ait tranché la sous-catégorie, ce qui les fait entrer dans
   * le calcul.
   */
  it("S31: five files without a subcategory are not recurrent, and cannot leave 'new'", async () => {
    for (let i = 1; i <= 5; i += 1) {
      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, created_by_user_id)
         VALUES ('2026-08-20', ?, ?, NULL, ?, 'normal', 'new', ?)`
      ).bind(locationMtlId, categoryId, `Erreur non qualifiee ${i}`, employeeId).run();
    }

    const res = await app.request("http://local/api/analytics/recurring", { headers: EMPLOYEE_HEADER }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    // Ni groupe local, ni groupe organisation : le regroupement se fait sur la
    // sous-catégorie, et il n'y en a aucune.
    expect(body.data).toHaveLength(0);

    // Seconde moitié : aucun de ces dossiers ne peut être pris en charge tant
    // que la sous-catégorie n'est pas tranchée.
    const target = await env.DB.prepare(
      "SELECT id FROM issues WHERE subcategory_id IS NULL ORDER BY id LIMIT 1"
    ).first<{ id: number }>();
    const publicId = `INC-${String(target!.id).padStart(6, "0")}`;

    const detail = await app.request(`http://local/api/issues/${publicId}`, { headers: MANAGER_HEADER }, env);
    const etag = detail.headers.get("ETag") as string;

    const blocked = await app.request(
      `http://local/api/issues/${publicId}`,
      {
        method: "PATCH",
        headers: { ...MANAGER_HEADER, "If-Match": etag },
        body: JSON.stringify({ status: "inProgress" }),
      },
      env
    );
    expect(blocked.status).toBe(422);
    const blockedBody = (await blocked.json()) as any;
    expect(blockedBody.error.fields.subcategoryId).toBeDefined();

    // Une fois la sous-catégorie tranchée, le dossier avance et entre dans le
    // périmètre du calcul de récurrence.
    const allowed = await app.request(
      `http://local/api/issues/${publicId}`,
      {
        method: "PATCH",
        headers: { ...MANAGER_HEADER, "If-Match": etag },
        body: JSON.stringify({ status: "inProgress", subcategoryId: subcategory1Id }),
      },
      env
    );
    expect(allowed.status).toBe(200);
  });

  it("S32: calculates effectiveness rates from issues.effectiveness_status, excluding pending (ANA-02)", async () => {
    // 2 effectifs, 1 inefficace, 3 pending
    for (let i = 0; i < 2; i++) {
      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, created_by_user_id)
         VALUES ('2026-08-20', ?, ?, ?, 'Effective', 'normal', 'resolved', 'effective', ?)`
      ).bind(locationMtlId, categoryId, subcategory1Id, employeeId).run();
    }
    await env.DB.prepare(
      `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, created_by_user_id)
       VALUES ('2026-08-20', ?, ?, ?, 'Ineffective', 'normal', 'resolved', 'ineffective', ?)`
    ).bind(locationMtlId, categoryId, subcategory1Id, employeeId).run();

    for (let i = 0; i < 3; i++) {
      await env.DB.prepare(
        `INSERT INTO issues (occurred_on, location_id, category_id, subcategory_id, description, priority, status, effectiveness_status, created_by_user_id)
         VALUES ('2026-08-20', ?, ?, ?, 'Pending', 'normal', 'resolved', 'pending', ?)`
      ).bind(locationMtlId, categoryId, subcategory1Id, employeeId).run();
    }

    const res = await app.request("http://local/api/analytics/effectiveness", { headers: EMPLOYEE_HEADER }, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;

    expect(body.data.effective).toBe(2);
    expect(body.data.ineffective).toBe(1);
    expect(body.data.pending).toBe(3);
    // 2 / (2 + 1) = 0.67
    expect(body.data.effectivenessRate).toBe(0.67);
  });

  it("S56: groups errors by employee and type for management without exposing email", async () => {
    for (let i = 0; i < 2; i++) {
      await env.DB.prepare(
        `INSERT INTO issues (
          occurred_on, location_id, category_id, subcategory_id, description,
          priority, status, error_actor_user_id, created_by_user_id
        ) VALUES ('2026-08-20', ?, ?, ?, ?, 'normal', 'new', ?, ?)`
      )
        .bind(
          locationMtlId,
          categoryId,
          subcategory1Id,
          `Erreur de prix ${i + 1}`,
          employeeId,
          managerId
        )
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO issues (
        occurred_on, location_id, category_id, subcategory_id, description,
        priority, status, error_actor_user_id, created_by_user_id
      ) VALUES ('2026-08-21', ?, ?, ?, 'Erreur de stock', 'normal', 'new', ?, ?)`
    )
      .bind(locationMtlId, categoryId, subcategory2Id, employeeId, managerId)
      .run();

    const forbidden = await app.request(
      "http://local/api/analytics/errors-by-employee",
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(forbidden.status).toBe(403);

    const res = await app.request(
      "http://local/api/analytics/errors-by-employee?from=2026-08-20&to=2026-08-21",
      { headers: MANAGER_HEADER },
      env
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.data).toHaveLength(2);
    expect(body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: employeeId,
          displayName: "Employé",
          active: true,
          subcategoryId: subcategory1Id,
          count: 2,
        }),
        expect.objectContaining({
          userId: employeeId,
          displayName: "Employé",
          active: true,
          subcategoryId: subcategory2Id,
          count: 1,
        }),
      ])
    );
    for (const row of body.data) expect(row).not.toHaveProperty("email");
  });
});
