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

/**
 * Référentiels actifs uniquement, triés pour affichage (G-022 : ces
 * listes ne doivent jamais être codées en dur côté UI).
 */
export async function listActiveReferences(
  db: D1Database,
  table: ReferenceTable
): Promise<ReferenceItem[]> {
  const parentColumn = PARENT_COLUMN_BY_TABLE[table];
  const columns = parentColumn
    ? `id, code, label, active, sort_order, ${parentColumn} AS parent_id`
    : "id, code, label, active, sort_order";
  const { results } = await db
    .prepare(`SELECT ${columns} FROM ${table} WHERE active = 1 ORDER BY sort_order, id`)
    .all<ReferenceRow>();
  return results.map(mapReferenceRow);
}
