import {
  fetchAnalyticsSummary,
  fetchEffectiveness,
  fetchRecurringGroups,
  type AnalyticsFilterParams,
  type ApiAnalyticsSummary,
  type ApiEffectiveness,
  type ApiRecurringGroup,
} from "../db/analytics";

export async function getAnalyticsSummary(
  db: D1Database,
  filters: AnalyticsFilterParams
): Promise<ApiAnalyticsSummary> {
  return fetchAnalyticsSummary(db, filters);
}

export async function getRecurringIssues(
  db: D1Database,
  filters: {
    locationId?: number;
    departmentId?: number;
    categoryId?: number;
  },
  config: {
    windowDays: number;
    minCount: number;
  }
): Promise<ApiRecurringGroup[]> {
  return fetchRecurringGroups(db, {
    ...filters,
    windowDays: config.windowDays,
    minCount: config.minCount,
  });
}

export async function getEffectivenessMetrics(
  db: D1Database,
  filters: {
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ApiEffectiveness> {
  return fetchEffectiveness(db, filters);
}
