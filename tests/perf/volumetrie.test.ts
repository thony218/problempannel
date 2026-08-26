import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { app } from "../../worker/index";
import { encodeCursor } from "../../worker/domain/cursor";
import { DEFAULT_SHAPE, RARE_SEARCH_TOKEN, seedVolumeDataset, type SeededDataset } from "./support/dataset";
import { formatReport, measure, type LatencyReport } from "./support/measure";

/**
 * Volumétrie et budgets p95 — `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md`.
 *
 * Ce fichier n'est **pas** collecté par `npm run test` ni par `npm run verify` :
 * il vit dans sa propre configuration (`vitest.perf.config.ts`, `npm run
 * test:perf`) parce qu'amorcer 100 000 dossiers prend beaucoup plus de temps
 * qu'une suite unitaire et ruinerait le temps de réponse de la CI.
 *
 * ## Ce que cette mesure prouve, et ce qu'elle ne prouve pas
 *
 * Elle s'exécute sur le D1 **local** de Miniflare, c'est-à-dire un SQLite sur
 * le disque de la machine de développement, appelé sans réseau. Elle mesure
 * donc le coût des requêtes à l'échelle réelle : plan d'exécution, index
 * utilisés ou non, balayages complets. C'est ce qui permet de voir qu'une
 * recherche `LIKE '%…%'` scanne toute la table.
 *
 * Elle ne remplace pas la mesure exigée « p95 staging » : la latence réseau,
 * le placement de la base D1, la concurrence réelle et le démarrage à froid du
 * Worker n'y figurent pas. Un dépassement ici est un problème certain; un
 * succès ici reste une condition nécessaire, pas suffisante.
 *
 * Volume ajustable : `PERF_ISSUES=5000 npm run test:perf`.
 */

/** Budgets p95, en millisecondes, repris tels quels des exigences gelées. */
const BUDGET = {
  me: 500,
  read: 750,
  write: 1000,
  analytics: 2000,
} as const;

/**
 * Le volume et le nombre d'itérations arrivent par liaison Miniflare, pas par
 * `process.env` : ce fichier s'exécute dans workerd, où `process.env` est vide.
 * Une première version lisait `process.env` et retombait toujours sur la
 * valeur par défaut — la mesure annonçait le volume demandé tout en mesurant
 * autre chose.
 */
declare global {
  namespace Cloudflare {
    interface Env {
      PERF_ISSUES: number;
      PERF_ITERATIONS: number;
    }
  }
}

const ISSUE_COUNT = Number(env.PERF_ISSUES ?? DEFAULT_SHAPE.issues);
const ITERATIONS = Number(env.PERF_ITERATIONS ?? 20);

let data: SeededDataset;
let managerHeaders: Record<string, string>;

/** Journalise la mesure puis applique le budget. */
function assertBudget(report: LatencyReport, budgetMs: number): void {
  console.log(formatReport(report, budgetMs));
  expect.soft(report.p95, `${report.label} dépasse le budget p95 de ${budgetMs} ms`).toBeLessThanOrEqual(budgetMs);
}

beforeAll(async () => {
  const started = performance.now();
  data = await seedVolumeDataset(env.DB, { ...DEFAULT_SHAPE, issues: ISSUE_COUNT });
  managerHeaders = { "X-Dev-User-Email": data.managerEmail, "Content-Type": "application/json" };
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`Jeu de données amorcé : ${ISSUE_COUNT} dossiers en ${seconds} s.`);
}, 900_000);

async function getStatus(path: string, headers = managerHeaders): Promise<number> {
  const res = await app.request(`http://local/api${path}`, { method: "GET", headers }, env);
  return res.status;
}

describe(`Volumétrie ${ISSUE_COUNT} dossiers`, () => {
  it("a bien inséré le volume demandé", async () => {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM issues").first<{ n: number }>();
    expect(row!.n).toBe(ISSUE_COUNT);
  });

  it("répond à /me sous le budget p95 de 500 ms", async () => {
    const report = await measure("GET /me", () => getStatus("/me"), 200, { iterations: ITERATIONS });
    assertBudget(report, BUDGET.me);
  });

  it("répond à /meta sous le budget de lecture", async () => {
    // Le NFR ne nomme pas /meta. Le budget de lecture lui est appliqué parce
    // que l'application est bloquée sur cet appel au démarrage : sa latence est
    // perçue exactement comme celle d'une liste.
    const report = await measure("GET /meta", () => getStatus("/meta"), 200, { iterations: ITERATIONS });
    assertBudget(report, BUDGET.read);
  });

  describe("Liste et détail — budget p95 750 ms", () => {
    it("liste la première page sans filtre", async () => {
      const report = await measure("GET /issues (page 1)", () => getStatus("/issues?limit=25"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.read);
    });

    it("liste avec filtres combinés", async () => {
      const path = `/issues?limit=25&status=new&status=inProgress&priority=urgent&locationId=${data.locationIds[0]}&categoryId=${data.categoryIds[0]}`;
      const report = await measure("GET /issues (filtres combinés)", () => getStatus(path), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.read);
    });

    it("liste les dossiers en retard", async () => {
      const report = await measure("GET /issues?overdue=true", () => getStatus("/issues?overdue=true&limit=25"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.read);
    });

    it("liste triée par échéance", async () => {
      const report = await measure("GET /issues?sort=dueDate", () => getStatus("/issues?sort=dueDate&limit=25"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.read);
    });

    /**
     * Cas défavorable connu : `q` est traduit en `description LIKE '%…%'`,
     * qu'aucun index ne peut servir. Le coût croît linéairement avec la table.
     */
    it("recherche plein texte sur un terme rare", async () => {
      const report = await measure(
        `GET /issues?q=${RARE_SEARCH_TOKEN}`,
        () => getStatus(`/issues?q=${RARE_SEARCH_TOKEN}&limit=25`),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });

    /**
     * Pire cas réel de la recherche : un terme qui ne correspond à **rien**.
     *
     * Un terme rare mais présent n'est pas le pire cas — `LIMIT 26` laisse
     * SQLite s'arrêter dès qu'il a rempli la page. Sans aucune correspondance,
     * le balayage va jusqu'au bout de la table. C'est la mesure qui dit
     * vraiment ce que coûte l'absence d'index plein texte.
     */
    it("recherche plein texte sans aucune correspondance", async () => {
      const report = await measure(
        "GET /issues?q=<sans correspondance>",
        () => getStatus("/issues?q=zzintrouvable&limit=25"),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });

    it("recherche plein texte sur un terme fréquent", async () => {
      const report = await measure(
        "GET /issues?q=commande",
        () => getStatus("/issues?q=commande&limit=25"),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });

    /**
     * La pagination est par curseur opaque, jamais par OFFSET : la dernière
     * page doit coûter le même prix que la première. C'est précisément ce que
     * cette mesure vérifie à 100 000 lignes.
     */
    it("récupère la dernière page aussi vite que la première", async () => {
      const oldest = Number(data.deepPublicId.replace("INC-", ""));
      const cursor = encodeCursor({ id: oldest + 25, sort: "newest" });
      const report = await measure(
        "GET /issues (dernière page par curseur)",
        () => getStatus(`/issues?limit=25&cursor=${encodeURIComponent(cursor)}`),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });

    it("ouvre le détail d'un dossier", async () => {
      const report = await measure(
        "GET /issues/{publicId}",
        () => getStatus(`/issues/${data.deepPublicId}`),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });

    it("lit l'historique d'un dossier", async () => {
      const report = await measure(
        "GET /issues/{publicId}/history",
        () => getStatus(`/issues/${data.deepPublicId}/history`),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.read);
    });
  });

  describe("Écritures — budget p95 1 000 ms", () => {
    it("crée un dossier", async () => {
      const report = await measure(
        "POST /issues",
        async (i) => {
          const res = await app.request(
            "http://local/api/issues",
            {
              method: "POST",
              headers: managerHeaders,
              body: JSON.stringify({
                occurredOn: "2026-08-25",
                locationId: data.locationIds[0],
                categoryId: data.categoryIds[0],
                description: `Dossier de mesure de charge numero ${i} avec une description suffisante.`,
                priority: "normal",
                impacts: [{ impactTypeId: data.impactTypeIds[0], details: null }],
              }),
            },
            env
          );
          return res.status;
        },
        201,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.write);
    });

    /**
     * Chaque modification incrémente `row_version`, donc périme l'ETag. La
     * mesure enchaîne les versions au lieu de relire le dossier entre deux
     * écritures : relire fausserait la mesure en y ajoutant une lecture.
     */
    it("modifie un dossier avec If-Match", async () => {
      const detail = await app.request(
        `http://local/api/issues/${data.editablePublicId}`,
        { method: "GET", headers: managerHeaders },
        env
      );
      let etag = detail.headers.get("ETag") as string;

      const report = await measure(
        "PATCH /issues/{publicId}",
        async (i) => {
          const res = await app.request(
            `http://local/api/issues/${data.editablePublicId}`,
            {
              method: "PATCH",
              headers: { ...managerHeaders, "If-Match": etag },
              body: JSON.stringify({ priority: i % 2 === 0 ? "important" : "normal" }),
            },
            env
          );
          const next = res.headers.get("ETag");
          if (next) etag = next;
          return res.status;
        },
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.write);
    });

    it("ajoute un commentaire", async () => {
      const report = await measure(
        "POST /issues/{publicId}/comments",
        async (i) => {
          const res = await app.request(
            `http://local/api/issues/${data.editablePublicId}/comments`,
            {
              method: "POST",
              headers: managerHeaders,
              body: JSON.stringify({ body: `Commentaire de mesure ${i}.` }),
            },
            env
          );
          return res.status;
        },
        201,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.write);
    });
  });

  describe("Analytique — budget p95 2 000 ms", () => {
    it("calcule le résumé", async () => {
      const report = await measure("GET /analytics/summary", () => getStatus("/analytics/summary"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.analytics);
    });

    it("calcule le résumé filtré sur une période", async () => {
      const report = await measure(
        "GET /analytics/summary (période)",
        () => getStatus("/analytics/summary?dateFrom=2026-01-01&dateTo=2026-12-31"),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.analytics);
    });

    it("détecte les récurrences 3/90", async () => {
      const report = await measure("GET /analytics/recurring", () => getStatus("/analytics/recurring"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.analytics);
    });

    it("calcule l'efficacité", async () => {
      const report = await measure("GET /analytics/effectiveness", () => getStatus("/analytics/effectiveness"), 200, {
        iterations: ITERATIONS,
      });
      assertBudget(report, BUDGET.analytics);
    });

    it("agrège les erreurs par employé", async () => {
      const report = await measure(
        "GET /analytics/errors-by-employee",
        () => getStatus("/analytics/errors-by-employee"),
        200,
        { iterations: ITERATIONS }
      );
      assertBudget(report, BUDGET.analytics);
    });
  });
});
