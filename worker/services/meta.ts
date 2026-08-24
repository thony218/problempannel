import { listActiveReferences } from "../db/reference";

export interface MetaConfig {
  businessTimeZone: string;
  maxAttachmentBytes: number;
  maxAttachmentsPerIssue: number;
  recurringWindowDays: number;
  recurringMinCount: number;
}

export interface Meta {
  locations: Awaited<ReturnType<typeof listActiveReferences>>;
  departments: Awaited<ReturnType<typeof listActiveReferences>>;
  categories: Awaited<ReturnType<typeof listActiveReferences>>;
  subcategories: Awaited<ReturnType<typeof listActiveReferences>>;
  impactTypes: Awaited<ReturnType<typeof listActiveReferences>>;
  config: MetaConfig;
}

export async function buildMeta(db: D1Database, config: MetaConfig): Promise<Meta> {
  const [locations, departments, categories, subcategories, impactTypes] = await Promise.all([
    listActiveReferences(db, "locations"),
    listActiveReferences(db, "departments"),
    listActiveReferences(db, "categories"),
    listActiveReferences(db, "subcategories"),
    listActiveReferences(db, "impact_types"),
  ]);
  return { locations, departments, categories, subcategories, impactTypes, config };
}
