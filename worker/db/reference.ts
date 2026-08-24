export interface ReferenceItem {
  id: number;
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

interface ReferenceRow {
  id: number;
  code: string;
  label: string;
  active: number;
  sort_order: number;
}

function mapReferenceRow(row: ReferenceRow): ReferenceItem {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    active: row.active === 1,
    sortOrder: row.sort_order,
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

/**
 * Référentiels actifs uniquement, triés pour affichage (G-022 : ces
 * listes ne doivent jamais être codées en dur côté UI).
 */
export async function listActiveReferences(
  db: D1Database,
  table: ReferenceTable
): Promise<ReferenceItem[]> {
  const { results } = await db
    .prepare(
      `SELECT id, code, label, active, sort_order FROM ${table} WHERE active = 1 ORDER BY sort_order, id`
    )
    .all<ReferenceRow>();
  return results.map(mapReferenceRow);
}
