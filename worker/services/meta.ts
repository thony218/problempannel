import { listActiveReferences } from "../db/reference";
import { listUserDirectory } from "../db/users";
import type { AppConfig } from "../domain/config";

/** Le bloc `config` de /api/meta est exactement la configuration d'exécution. */
export type MetaConfig = AppConfig;

export interface Meta {
  locations: Awaited<ReturnType<typeof listActiveReferences>>;
  departments: Awaited<ReturnType<typeof listActiveReferences>>;
  categories: Awaited<ReturnType<typeof listActiveReferences>>;
  subcategories: Awaited<ReturnType<typeof listActiveReferences>>;
  impactTypes: Awaited<ReturnType<typeof listActiveReferences>>;
  users: Awaited<ReturnType<typeof listUserDirectory>>;
  config: MetaConfig;
}

export async function buildMeta(db: D1Database, config: MetaConfig): Promise<Meta> {
  const [locations, departments, categories, subcategories, impactTypes, users] = await Promise.all([
    listActiveReferences(db, "locations"),
    listActiveReferences(db, "departments"),
    listActiveReferences(db, "categories"),
    listActiveReferences(db, "subcategories"),
    listActiveReferences(db, "impact_types"),
    listUserDirectory(db),
  ]);
  return { locations, departments, categories, subcategories, impactTypes, users, config };
}
