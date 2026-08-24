export interface ReferenceItem {
  id: number;
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
  parentId?: number | null;
}

interface ReferenceRow {
  id: number;
  code: string;
  label: string;
  active: number;
  sort_order: number;
  parent_id?: number | null;
}

function mapReferenceRow(row: ReferenceRow): ReferenceItem {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    active: row.active === 1,
    sortOrder: row.sort_order,
    ...(row.parent_id !== undefined ? { parentId: row.parent_id } : {}),
  };
}

const REFERENCE_TABLES = [
  "locations",
  "departments",
  "categories",
  "subcategories",
  "impact_types",
] as const;

export type ReferenceTable = (typeof REFERENCE_TABLES)[number];

// Seule table référentielle avec un parent (subcategories -> categories).
// Exposé en tant que ReferenceItem.parentId pour que le frontend puisse
// filtrer les sous-catégories par catégorie sans coder la relation en dur.
const PARENT_COLUMN_BY_TABLE: Partial<Record<ReferenceTable, string>> = {
  subcategories: "category_id",
};

function referenceColumns(table: ReferenceTable): string {
  const parentColumn = PARENT_COLUMN_BY_TABLE[table];
  return parentColumn
    ? `id, code, label, active, sort_order, ${parentColumn} AS parent_id`
    : "id, code, label, active, sort_order";
}

/**
 * Référentiels actifs uniquement, triés pour affichage (G-022 : ces
 * listes ne doivent jamais être codées en dur côté UI).
 */
export async function listActiveReferences(
  db: D1Database,
  table: ReferenceTable
): Promise<ReferenceItem[]> {
  const { results } = await db
    .prepare(`SELECT ${referenceColumns(table)} FROM ${table} WHERE active = 1 ORDER BY sort_order, id`)
    .all<ReferenceRow>();
  return results.map(mapReferenceRow);
}

/**
 * Un seul élément actif par id — utilisé pour valider qu'une référence
 * soumise par un client (locationId, categoryId, ...) existe bien et est
 * active avant d'écrire en D1 (G-010 : règle métier vérifiée côté serveur,
 * pas seulement par la contrainte FK — cf. createIssue).
 */
export async function findActiveReferenceById(
  db: D1Database,
  table: ReferenceTable,
  id: number
): Promise<ReferenceItem | null> {
  const row = await db
    .prepare(`SELECT ${referenceColumns(table)} FROM ${table} WHERE id = ? AND active = 1`)
    .bind(id)
    .first<ReferenceRow>();
  return row ? mapReferenceRow(row) : null;
}

/**
 * Version multi-id de findActiveReferenceById, pour valider une liste
 * (ex: les impactTypeId d'une création de dossier) en une seule requête.
 */
export async function findActiveReferencesByIds(
  db: D1Database,
  table: ReferenceTable,
  ids: number[]
): Promise<Map<number, ReferenceItem>> {
  if (ids.length === 0) {
    return new Map();
  }
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await db
    .prepare(`SELECT ${referenceColumns(table)} FROM ${table} WHERE active = 1 AND id IN (${placeholders})`)
    .bind(...ids)
    .all<ReferenceRow>();
  return new Map(results.map(mapReferenceRow).map((item) => [item.id, item]));
}
