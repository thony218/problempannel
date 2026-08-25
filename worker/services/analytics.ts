import {
  fetchAnalyticsSummary,
  fetchEffectiveness,
  fetchRecurringGroups,
  type AnalyticsFilterParams,
  type ApiAnalyticsSummary,
  type ApiEffectiveness,
  type ApiRecurringGroup,
} from "../db/analytics";
import { businessToday, type AppConfig } from "../domain/config";

export async function getAnalyticsSummary(
  db: D1Database,
  filters: AnalyticsFilterParams,
  config: Pick<AppConfig, "businessTimeZone">
): Promise<ApiAnalyticsSummary> {
  return fetchAnalyticsSummary(db, {
    ...filters,
    businessToday: businessToday(config.businessTimeZone),
  });
}

export async function getRecurringIssues(
  db: D1Database,
  filters: {
    locationId?: number;
    departmentId?: number;
    categoryId?: number;
  },
  config: Pick<AppConfig, "businessTimeZone" | "recurringWindowDays" | "recurringMinCount">
): Promise<ApiRecurringGroup[]> {
  return fetchRecurringGroups(db, {
    ...filters,
    windowDays: config.recurringWindowDays,
    minCount: config.recurringMinCount,
    businessToday: businessToday(config.businessTimeZone),
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
