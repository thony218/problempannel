import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";

export type ApiAnalyticsSummary = components["schemas"]["AnalyticsSummary"];
export type ApiRecurringGroup = components["schemas"]["RecurringGroup"];
export type ApiEffectiveness = components["schemas"]["Effectiveness"];

export interface AnalyticsFilterParams {
  dateFrom?: string;
  dateTo?: string;
  locationId?: number;
  departmentId?: number;
  categoryId?: number;
}

/**
 * Date métier courante (AAAA-MM-JJ), fournie par l'appelant.
 *
 * `date('now')` renvoie la date **UTC**. 01_produit/08_DEFINITIONS_ANALYTIQUES.md
 * définit « Dossier en retard » par rapport à la *date métier courante*, et
 * `queryIssuesList` applique déjà cette règle : s'en écarter ici ferait
 * répondre `/api/issues?overdue=true` et `/api/analytics/summary`
 * différemment sur le même dossier pendant les quatre à cinq heures qui
 * séparent le soir montréalais du lendemain UTC.
 */
export interface BusinessDateParam {
  businessToday: string;
}

export async function fetchAnalyticsSummary(
  db: D1Database,
  filters: AnalyticsFilterParams & BusinessDateParam
): Promise<ApiAnalyticsSummary> {
  const whereClauses: string[] = [];
  const binds: (number | string)[] = [];

  if (filters.locationId !== undefined) {
    whereClauses.push("location_id = ?");
    binds.push(filters.locationId);
  }
  if (filters.departmentId !== undefined) {
    whereClauses.push("department_id = ?");
    binds.push(filters.departmentId);
  }
  if (filters.categoryId !== undefined) {
    whereClauses.push("category_id = ?");
    binds.push(filters.categoryId);
  }
  if (filters.dateFrom !== undefined) {
    whereClauses.push("occurred_on >= ?");
    binds.push(filters.dateFrom);
  }
  if (filters.dateTo !== undefined) {
    whereClauses.push("occurred_on <= ?");
    binds.push(filters.dateTo);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const query = `
    SELECT
      COUNT(CASE WHEN status != 'resolved' THEN 1 END) as open_count,
      COUNT(CASE WHEN status != 'resolved' AND priority = 'urgent' THEN 1 END) as urgent_count,
      COUNT(CASE WHEN status != 'resolved' AND due_date IS NOT NULL AND date(due_date) < date(?) THEN 1 END) as overdue_count,
      COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_count,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_count,
      COUNT(CASE WHEN status = 'resolved' AND effectiveness_status = 'pending' THEN 1 END) as pending_effectiveness_count,
      AVG(CASE WHEN status = 'resolved' AND resolved_at IS NOT NULL THEN (strftime('%s', resolved_at) - strftime('%s', created_at)) / 3600.0 END) as avg_resolution_hours
    FROM issues
    ${whereSql}
  `;

  // `?` de overdue_count apparaît dans le SELECT, donc avant ceux du WHERE.
  const row = await db.prepare(query).bind(filters.businessToday, ...binds).first<{
    open_count: number;
    urgent_count: number;
    overdue_count: number;
    waiting_count: number;
    resolved_count: number;
    pending_effectiveness_count: number;
    avg_resolution_hours: number | null;
  }>();

  return {
    open: row?.open_count ?? 0,
    urgent: row?.urgent_count ?? 0,
    overdue: row?.overdue_count ?? 0,
    waiting: row?.waiting_count ?? 0,
    resolved: row?.resolved_count ?? 0,
    pendingEffectiveness: row?.pending_effectiveness_count ?? 0,
    averageResolutionHours: row?.avg_resolution_hours !== null && row?.avg_resolution_hours !== undefined
      ? Number(row.avg_resolution_hours.toFixed(1))
      : null,
  };
}

export async function fetchRecurringGroups(
  db: D1Database,
  filters: {
    locationId?: number;
    departmentId?: number;
    categoryId?: number;
    windowDays: number;
    minCount: number;
    businessToday: string;
  }
): Promise<ApiRecurringGroup[]> {
  const { windowDays, minCount, businessToday } = filters;
  const groups: ApiRecurringGroup[] = [];

  // 1. Récurrence locale (scope: 'location') -> location_id + subcategory_id
  let locWhere = "subcategory_id IS NOT NULL AND occurred_on >= date(?, '-' || ? || ' days')";
  const locBinds: (number | string)[] = [businessToday, windowDays];

  if (filters.locationId !== undefined) {
    locWhere += " AND location_id = ?";
    locBinds.push(filters.locationId);
  }
  if (filters.departmentId !== undefined) {
    locWhere += " AND department_id = ?";
    locBinds.push(filters.departmentId);
  }
  if (filters.categoryId !== undefined) {
    locWhere += " AND category_id = ?";
    locBinds.push(filters.categoryId);
  }

  const locQuery = `
    SELECT
      location_id,
      subcategory_id,
      COUNT(*) as count,
      MAX(id) as latest_id
    FROM issues
    WHERE ${locWhere}
    GROUP BY location_id, subcategory_id
    HAVING COUNT(*) >= ?
    ORDER BY count DESC
  `;
  locBinds.push(minCount);

  const locResults = await db.prepare(locQuery).bind(...locBinds).all<{
    location_id: number;
    subcategory_id: number;
    count: number;
    latest_id: number;
  }>();

  for (const row of locResults.results || []) {
    groups.push({
      scope: "location",
      locationId: row.location_id,
      subcategoryId: row.subcategory_id,
      count: row.count,
      windowDays,
      latestIssuePublicId: toPublicId(row.latest_id),
    });
  }

  // 2. Récurrence organisationnelle (scope: 'organization') -> subcategory_id
  let orgWhere = "subcategory_id IS NOT NULL AND occurred_on >= date(?, '-' || ? || ' days')";
  const orgBinds: (number | string)[] = [businessToday, windowDays];

  if (filters.departmentId !== undefined) {
    orgWhere += " AND department_id = ?";
    orgBinds.push(filters.departmentId);
  }
  if (filters.categoryId !== undefined) {
    orgWhere += " AND category_id = ?";
    orgBinds.push(filters.categoryId);
  }

  const orgQuery = `
    SELECT
      subcategory_id,
      COUNT(*) as count,
      MAX(id) as latest_id
    FROM issues
    WHERE ${orgWhere}
    GROUP BY subcategory_id
    HAVING COUNT(*) >= ?
    ORDER BY count DESC
  `;
  orgBinds.push(minCount);

  const orgResults = await db.prepare(orgQuery).bind(...orgBinds).all<{
    subcategory_id: number;
    count: number;
    latest_id: number;
  }>();

  for (const row of orgResults.results || []) {
    groups.push({
      scope: "organization",
      locationId: null,
      subcategoryId: row.subcategory_id,
      count: row.count,
      windowDays,
      latestIssuePublicId: toPublicId(row.latest_id),
    });
  }

  return groups;
}

export async function fetchEffectiveness(
  db: D1Database,
  filters: { dateFrom?: string; dateTo?: string }
): Promise<ApiEffectiveness> {
  const whereClauses: string[] = ["effectiveness_status IS NOT NULL"];
  const binds: (number | string)[] = [];

  if (filters.dateFrom !== undefined) {
    whereClauses.push("occurred_on >= ?");
    binds.push(filters.dateFrom);
  }
  if (filters.dateTo !== undefined) {
    whereClauses.push("occurred_on <= ?");
    binds.push(filters.dateTo);
  }

  const query = `
    SELECT
      COUNT(CASE WHEN effectiveness_status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN effectiveness_status = 'effective' THEN 1 END) as effective_count,
      COUNT(CASE WHEN effectiveness_status = 'ineffective' THEN 1 END) as ineffective_count
    FROM issues
    WHERE ${whereClauses.join(" AND ")}
  `;

  const row = await db.prepare(query).bind(...binds).first<{
    pending_count: number;
    effective_count: number;
    ineffective_count: number;
  }>();

  const pending = row?.pending_count ?? 0;
  const effective = row?.effective_count ?? 0;
  const ineffective = row?.ineffective_count ?? 0;
  const evaluated = effective + ineffective;
  const effectivenessRate = evaluated > 0 ? Number((effective / evaluated).toFixed(2)) : null;

  return {
    pending,
    effective,
    ineffective,
    effectivenessRate,
  };
}
