/**
 * Générateur de jeu de données volumétrique déterministe.
 *
 * `01_produit/06_EXIGENCES_NON_FONCTIONNELLES.md` fixe la volumétrie cible :
 * 100 utilisateurs, 5 000 dossiers par an, 100 000 dossiers historiques. Les
 * tests d'API existants travaillent sur quelques dizaines de lignes, ce qui ne
 * dit rien du comportement des requêtes à l'échelle réelle — en particulier
 * pour la recherche `q`, qui est un `LIKE '%…%'` sans index, et pour les
 * agrégats analytiques qui balaient toute la table.
 *
 * Le tirage est déterministe (générateur `mulberry32` amorcé par une graine
 * fixe) : deux exécutions produisent la même base, donc deux mesures sont
 * comparables. Un jeu aléatoire non reproductible rendrait toute régression
 * de performance indiscernable du bruit de tirage.
 */

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DatasetShape {
  /** Nombre de dossiers à créer. */
  issues: number;
  /** Nombre d'utilisateurs internes (NFR : 100). */
  users: number;
  /** Nombre de succursales. */
  locations: number;
  /** Nombre de catégories. */
  categories: number;
  /** Sous-catégories par catégorie. */
  subcategoriesPerCategory: number;
  /** Étalement des dossiers, en jours, en remontant depuis `today`. */
  spreadDays: number;
}

export const DEFAULT_SHAPE: DatasetShape = {
  issues: 100_000,
  users: 100,
  locations: 12,
  categories: 9,
  subcategoriesPerCategory: 3,
  spreadDays: 5 * 365,
};

/**
 * Jeton rare inséré dans une petite fraction des descriptions.
 *
 * La recherche doit rester coûteuse même quand elle ne ramène presque rien :
 * c'est le cas défavorable, puisque le balayage complet a lieu de toute façon.
 */
export const RARE_SEARCH_TOKEN = "palettisation";

/** Fraction des descriptions contenant `RARE_SEARCH_TOKEN`. */
const RARE_TOKEN_RATE = 0.003;

const DEPARTMENT_CODES = [
  "sales",
  "service_repairs",
  "warehouse_inventory",
  "administration",
  "management",
  "route_installation",
  "other",
];

const PRIORITIES = ["normal", "normal", "normal", "important", "important", "urgent"];

const DESCRIPTION_FRAGMENTS = [
  "Erreur de saisie constatee sur le bon de commande",
  "Piece manquante a la livraison du client",
  "Mauvaise configuration de l appareil a l installation",
  "Retard de traitement sur la demande de garantie",
  "Inventaire non conforme au comptage physique",
  "Facturation incorrecte transmise au client",
  "Procedure non suivie lors de la reparation",
  "Communication incomplete entre les equipes",
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** Décale une date de `days` jours. */
function shiftDate(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)}`;
}

function isoStamp(d: Date, hour: number, minute: number): string {
  return `${isoDate(d)}T${pad(hour, 2)}:${pad(minute, 2)}:00.000Z`;
}

/** Échappe une valeur texte pour une insertion SQL littérale. */
function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlValue(value: string | number | null): string {
  if (value === null) return "NULL";
  return typeof value === "number" ? String(value) : q(value);
}

export interface SeededDataset {
  /** Identifiants réellement présents, pour construire des requêtes filtrées. */
  locationIds: number[];
  categoryIds: number[];
  subcategoryIds: number[];
  impactTypeIds: number[];
  employeeIds: number[];
  managerId: number;
  managerEmail: string;
  employeeEmail: string;
  /** publicId d'un dossier au statut `new`, modifiable sans précondition. */
  editablePublicId: string;
  /** publicId du dossier le plus ancien, en fin de pagination. */
  deepPublicId: string;
  issueCount: number;
}

/**
 * Purge puis reconstruit intégralement la base locale à la forme demandée.
 *
 * Les insertions passent par `exec` avec des littéraux groupés plutôt que par
 * des requêtes préparées liées : SQLite plafonne le nombre de variables liées
 * par requête, et 100 000 lignes une par une prennent plusieurs minutes. Les
 * littéraux sont sûrs ici car toutes les valeurs sont produites par ce module,
 * jamais par une entrée externe.
 */
export async function seedVolumeDataset(
  db: D1Database,
  shape: DatasetShape = DEFAULT_SHAPE,
  today: Date = new Date()
): Promise<SeededDataset> {
  const random = makeRandom(20260825);

  await db.exec(
    [
      "DELETE FROM issue_history",
      "DELETE FROM issue_links",
      "DELETE FROM attachments",
      "DELETE FROM comments",
      "DELETE FROM corrective_actions",
      "DELETE FROM issue_impacts",
      "DELETE FROM issues",
      "DELETE FROM users",
      "DELETE FROM subcategories",
      "DELETE FROM categories",
      "DELETE FROM departments",
      "DELETE FROM locations",
      "DELETE FROM impact_types",
      "DELETE FROM sqlite_sequence",
    ].join("\n")
  );

  // ---- Référentiels ----
  const locationValues = Array.from({ length: shape.locations }, (_, i) =>
    `(${q(`loc_${pad(i + 1, 3)}`)}, ${q(`Succursale ${pad(i + 1, 3)}`)}, ${i + 1})`
  );
  await db.exec(`INSERT INTO locations (code,label,sort_order) VALUES ${locationValues.join(",")}`);

  const departmentValues = DEPARTMENT_CODES.map((code, i) => `(${q(code)}, ${q(code)}, ${i + 1})`);
  await db.exec(`INSERT INTO departments (code,label,sort_order) VALUES ${departmentValues.join(",")}`);

  const categoryValues = Array.from({ length: shape.categories }, (_, i) =>
    `(${q(`cat_${pad(i + 1, 2)}`)}, ${q(`Categorie ${pad(i + 1, 2)}`)}, ${i + 1})`
  );
  await db.exec(`INSERT INTO categories (code,label,sort_order) VALUES ${categoryValues.join(",")}`);

  const categoryIds = (
    await db.prepare("SELECT id FROM categories ORDER BY id").all<{ id: number }>()
  ).results.map((r) => r.id);

  const subcategoryValues: string[] = [];
  for (const categoryId of categoryIds) {
    for (let s = 0; s < shape.subcategoriesPerCategory; s += 1) {
      subcategoryValues.push(
        `(${categoryId}, ${q(`sub_${pad(s + 1, 2)}`)}, ${q(`Sous-categorie ${pad(s + 1, 2)}`)}, ${s + 1})`
      );
    }
  }
  await db.exec(
    `INSERT INTO subcategories (category_id,code,label,sort_order) VALUES ${subcategoryValues.join(",")}`
  );

  await db.exec(
    "INSERT INTO impact_types (code,label,sort_order) VALUES ('time_lost','Temps perdu',1),('client_delay','Retard client',2),('dissatisfaction','Insatisfaction',3),('rework','Reprise',4),('other','Autre',5)"
  );

  // ---- Utilisateurs ----
  const userValues: string[] = [
    `(${q("perf_manager@example.test")}, ${q("Gestionnaire Volumetrie")}, ${q("manager")}, 1)`,
    `(${q("perf_employee@example.test")}, ${q("Employe Volumetrie")}, ${q("employee")}, 1)`,
  ];
  for (let i = 0; i < shape.users - 2; i += 1) {
    userValues.push(
      `(${q(`perf_user_${pad(i + 1, 3)}@example.test`)}, ${q(`Employe ${pad(i + 1, 3)}`)}, ${q("employee")}, 1)`
    );
  }
  await db.exec(`INSERT INTO users (email,display_name,role,active) VALUES ${userValues.join(",")}`);

  const locationIds = (
    await db.prepare("SELECT id FROM locations ORDER BY id").all<{ id: number }>()
  ).results.map((r) => r.id);
  const departmentIds = (
    await db.prepare("SELECT id FROM departments ORDER BY id").all<{ id: number }>()
  ).results.map((r) => r.id);
  const subcategoryIds = (
    await db.prepare("SELECT id FROM subcategories ORDER BY id").all<{ id: number }>()
  ).results.map((r) => r.id);
  const impactTypeIds = (
    await db.prepare("SELECT id FROM impact_types ORDER BY id").all<{ id: number }>()
  ).results.map((r) => r.id);
  const userRows = (
    await db.prepare("SELECT id, role FROM users ORDER BY id").all<{ id: number; role: string }>()
  ).results;
  const managerId = userRows.find((u) => u.role === "manager")!.id;
  const employeeIds = userRows.filter((u) => u.role === "employee").map((u) => u.id);

  // ---- Dossiers ----
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)];
  const rows: string[] = [];
  // D1 refuse une requête trop longue (`SQLITE_TOOBIG`) bien avant la limite
  // SQLite habituelle : 500 lignes par INSERT produisaient 154 ko et étaient
  // rejetées. 100 lignes tiennent largement sous le plafond observé.
  const CHUNK = 100;

  for (let i = 0; i < shape.issues; i += 1) {
    const ageDays = Math.floor(random() * shape.spreadDays);
    const occurred = shiftDate(today, -ageDays);
    const createdAt = isoStamp(occurred, 8 + Math.floor(random() * 9), Math.floor(random() * 60));

    const roll = random();
    // 15 % new, 25 % in_progress, 10 % waiting, 50 % resolved.
    const status = roll < 0.15 ? "new" : roll < 0.4 ? "in_progress" : roll < 0.5 ? "waiting" : "resolved";

    // CHECK D1 : hors statut `new`, la sous-catégorie est obligatoire.
    const subcategoryId = status === "new" ? (random() < 0.5 ? pick(subcategoryIds) : null) : pick(subcategoryIds);

    const priority = pick(PRIORITIES);
    const ownerUserId = status === "new" ? (random() < 0.2 ? pick(employeeIds) : null) : pick(employeeIds);
    const errorActorUserId = random() < 0.5 ? pick(employeeIds) : null;
    const dueDate = random() < 0.6 ? isoDate(shiftDate(occurred, 5 + Math.floor(random() * 40))) : null;

    const waitingType = status === "waiting" ? "supplier" : null;
    const waitingLabel = status === "waiting" ? `Fournisseur ${pad(Math.floor(random() * 50) + 1, 3)}` : null;

    let resolvedAt: string | null = null;
    let resolvedBy: number | null = null;
    let effectivenessStatus: string | null = null;
    let reviewDate: string | null = null;
    let causeStatus: string | null = null;
    let causeSummary: string | null = null;
    let finalResult: string | null = null;
    if (status === "resolved") {
      const resolutionDays = 1 + Math.floor(random() * 20);
      const resolvedDate = shiftDate(occurred, resolutionDays);
      resolvedAt = isoStamp(resolvedDate, 9 + Math.floor(random() * 8), Math.floor(random() * 60));
      resolvedBy = managerId;
      const effRoll = random();
      effectivenessStatus = effRoll < 0.4 ? "pending" : effRoll < 0.85 ? "effective" : "ineffective";
      reviewDate = isoDate(shiftDate(resolvedDate, 30));
      causeStatus = "known";
      causeSummary = "Cause identifiee lors de la revue hebdomadaire.";
      finalResult = "Correction appliquee et validee par le gestionnaire.";
    }

    const fragment = pick(DESCRIPTION_FRAGMENTS);
    const rare = random() < RARE_TOKEN_RATE ? ` Incident lie a la ${RARE_SEARCH_TOKEN} du quai.` : "";
    const description = `${fragment} (dossier de charge ${pad(i + 1, 6)}).${rare}`;

    rows.push(
      "(" +
        [
          sqlValue(isoDate(occurred)),
          sqlValue(createdAt),
          sqlValue(createdAt),
          sqlValue(managerId),
          sqlValue(pick(locationIds)),
          sqlValue(pick(departmentIds)),
          sqlValue(pick(categoryIds)),
          sqlValue(subcategoryId),
          sqlValue(description),
          sqlValue(priority),
          sqlValue(status),
          sqlValue(ownerUserId),
          sqlValue(errorActorUserId),
          sqlValue(dueDate),
          sqlValue(waitingType),
          sqlValue(waitingLabel),
          sqlValue(resolvedAt),
          sqlValue(resolvedBy),
          sqlValue(effectivenessStatus),
          sqlValue(reviewDate),
          sqlValue(causeStatus),
          sqlValue(causeSummary),
          sqlValue(finalResult),
        ].join(",") +
        ")"
    );

    if (rows.length >= CHUNK) {
      await flushIssues(db, rows);
      rows.length = 0;
    }
  }
  if (rows.length > 0) {
    await flushIssues(db, rows);
  }

  // Un impact par dossier : le détail et l'export les lisent réellement.
  await db.exec(
    `INSERT INTO issue_impacts (issue_id, impact_type_id) SELECT id, ${impactTypeIds[0]} + (id % ${impactTypeIds.length}) FROM issues`
  );

  const firstNew = await db
    .prepare("SELECT id FROM issues WHERE status = 'new' ORDER BY id DESC LIMIT 1")
    .first<{ id: number }>();
  const deep = await db.prepare("SELECT id FROM issues ORDER BY id ASC LIMIT 1").first<{ id: number }>();

  return {
    locationIds,
    categoryIds,
    subcategoryIds,
    impactTypeIds,
    employeeIds,
    managerId,
    managerEmail: "perf_manager@example.test",
    employeeEmail: "perf_employee@example.test",
    editablePublicId: `INC-${pad(firstNew!.id, 6)}`,
    deepPublicId: `INC-${pad(deep!.id, 6)}`,
    issueCount: shape.issues,
  };
}

async function flushIssues(db: D1Database, rows: string[]): Promise<void> {
  await db.exec(
    "INSERT INTO issues (occurred_on,created_at,updated_at,created_by_user_id,location_id,department_id," +
      "category_id,subcategory_id,description,priority,status,owner_user_id,error_actor_user_id,due_date," +
      "waiting_on_type,waiting_on_label,resolved_at,resolved_by_user_id,effectiveness_status," +
      "effectiveness_review_date,cause_status,cause_summary,final_result) VALUES " +
      rows.join(",")
  );
}
