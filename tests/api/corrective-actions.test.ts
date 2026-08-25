import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../worker/index";

const EMPLOYEE_HEADER = { "X-Dev-User-Email": "emp@example.test", "Content-Type": "application/json" };
const OTHER_EMP_HEADER = { "X-Dev-User-Email": "other_emp@example.test", "Content-Type": "application/json" };
const MANAGER_HEADER = { "X-Dev-User-Email": "manager@example.test", "Content-Type": "application/json" };

let employeeId: number;
let otherEmployeeId: number;
let managerId: number;
let locationId: number;
let categoryId: number;
let impactId: number;

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM issue_history"),
    env.DB.prepare("DELETE FROM corrective_actions"),
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
        description: "Incident initial pour tester les actions correctives.",
        priority: "normal",
        impacts: [{ impactTypeId: impactId, details: null }],
      }),
    },
    env
  );
  const body = (await res.json()) as any;
  return { publicId: body.data.publicId as string };
}

describe("ACT-01 & ACT-02: API des actions correctives", () => {
  it("enforces role permissions on corrective action creation (ACT-01)", async () => {
    const { publicId } = await createIssue();

    // 1. Rejet si un employé tente de créer une action corrective (403)
    const empRes = await app.request(
      `http://local/api/issues/${publicId}/corrective-actions`,
      {
        method: "POST",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({
          title: "Corriger la configuration réseau",
          ownerUserId: employeeId,
          dueDate: "2026-09-15",
          status: "todo",
          blocksIssueClosure: true,
        }),
      },
      env
    );
    expect(empRes.status).toBe(403);

    // 2. Création réussie par un gestionnaire (201)
    const mgrRes = await app.request(
      `http://local/api/issues/${publicId}/corrective-actions`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({
          title: "Corriger la configuration réseau",
          description: "Mettre à jour les passerelles.",
          ownerUserId: employeeId,
          dueDate: "2026-09-15",
          status: "todo",
          blocksIssueClosure: true,
        }),
      },
      env
    );
    expect(mgrRes.status).toBe(201);
    const mgrBody = (await mgrRes.json()) as any;
    expect(mgrBody.data.title).toBe("Corriger la configuration réseau");
    expect(mgrBody.data.ownerUserId).toBe(employeeId);
    expect(mgrBody.data.blocksIssueClosure).toBe(true);
    expect(mgrBody.data.status).toBe("todo");

    // 3. Vérifier l'événement d'historique
    const historyRows = await env.DB.prepare(
      "SELECT event_type FROM issue_history WHERE event_type = 'corrective_action_created'"
    ).all();
    expect(historyRows.results).toHaveLength(1);
  });

  it("lists and gets corrective action details", async () => {
    const { publicId } = await createIssue();

    const createRes = await app.request(
      `http://local/api/issues/${publicId}/corrective-actions`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({
          title: "Remplacement du câble défectueux",
          ownerUserId: employeeId,
          dueDate: "2026-09-10",
          status: "inProgress",
          blocksIssueClosure: false,
        }),
      },
      env
    );
    const actionId = ((await createRes.json()) as any).data.id;

    // 1. Liste des actions pour le dossier
    const listRes = await app.request(
      `http://local/api/issues/${publicId}/corrective-actions`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data).toHaveLength(1);
    expect(listBody.data[0].id).toBe(actionId);

    // 2. Consultation d'une action par ID
    const getRes = await app.request(
      `http://local/api/corrective-actions/${actionId}`,
      { headers: EMPLOYEE_HEADER },
      env
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as any;
    expect(getBody.data.title).toBe("Remplacement du câble défectueux");
  });

  it("enforces granular permissions on corrective action update (ACT-02)", async () => {
    const { publicId } = await createIssue();

    const createRes = await app.request(
      `http://local/api/issues/${publicId}/corrective-actions`,
      {
        method: "POST",
        headers: MANAGER_HEADER,
        body: JSON.stringify({
          title: "Nettoyage des serveurs",
          ownerUserId: employeeId,
          dueDate: "2026-09-20",
          status: "todo",
          blocksIssueClosure: true,
        }),
      },
      env
    );
    const actionId = ((await createRes.json()) as any).data.id;

    // 1. Rejet si un autre employé tente de modifier l'action (403)
    const otherEmpRes = await app.request(
      `http://local/api/corrective-actions/${actionId}`,
      {
        method: "PATCH",
        headers: OTHER_EMP_HEADER,
        body: JSON.stringify({ status: "inProgress" }),
      },
      env
    );
    expect(otherEmpRes.status).toBe(403);

    // 2. Rejet si l'employé responsable tente de modifier le titre ou l'échéance (403)
    const empForbiddenFieldRes = await app.request(
      `http://local/api/corrective-actions/${actionId}`,
      {
        method: "PATCH",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({ title: "Nouveau titre non autorisé" }),
      },
      env
    );
    expect(empForbiddenFieldRes.status).toBe(403);

    // 3. Succès si l'employé responsable modifie status et result (200)
    const empSuccessRes = await app.request(
      `http://local/api/corrective-actions/${actionId}`,
      {
        method: "PATCH",
        headers: EMPLOYEE_HEADER,
        body: JSON.stringify({
          status: "done",
          result: "Nettoyage complété avec succès sur toutes les machines.",
        }),
      },
      env
    );
    expect(empSuccessRes.status).toBe(200);
    const empSuccessBody = (await empSuccessRes.json()) as any;
    expect(empSuccessBody.data.status).toBe("done");
    expect(empSuccessBody.data.result).toBe("Nettoyage complété avec succès sur toutes les machines.");
    expect(empSuccessBody.data.completedAt).not.toBeNull();

    // 4. Succès si le gestionnaire modifie le titre, l'échéance et l'évaluation d'efficacité (200)
    const mgrSuccessRes = await app.request(
      `http://local/api/corrective-actions/${actionId}`,
      {
        method: "PATCH",
        headers: MANAGER_HEADER,
        body: JSON.stringify({
          title: "Nettoyage et inspection annuelle des serveurs",
          dueDate: "2026-10-01",
          effectivenessStatus: "effective",
        }),
      },
      env
    );
    expect(mgrSuccessRes.status).toBe(200);
    const mgrSuccessBody = (await mgrSuccessRes.json()) as any;
    expect(mgrSuccessBody.data.title).toBe("Nettoyage et inspection annuelle des serveurs");
    expect(mgrSuccessBody.data.dueDate).toBe("2026-10-01");
    expect(mgrSuccessBody.data.effectivenessStatus).toBe("effective");
  });
});
