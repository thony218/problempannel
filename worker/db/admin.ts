import type { components } from "../../src/shared/api-types.generated";
import { toPublicId } from "../domain/publicId";
import { findIssueRowById, type IssueRow } from "./issues";

export type ApiUser = components["schemas"]["User"];
export type ApiReferenceItem = components["schemas"]["ReferenceItem"];
export type Role = components["schemas"]["Role"];

export interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: Role;
  active: number;
  default_location_id: number | null;
  default_department_id: number | null;
  created_at: string;
  updated_at: string;
}

export function mapUserRow(row: UserRow): ApiUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    active: Boolean(row.active),
    defaultLocationId: row.default_location_id,
    defaultDepartmentId: row.default_department_id,
  };
}

export async function listAllUsers(db: D1Database): Promise<UserRow[]> {
  const result = await db
    .prepare("SELECT * FROM users ORDER BY id ASC")
    .all<UserRow>();
  return result.results || [];
}

export async function insertUser(
  db: D1Database,
  data: {
    email: string;
    displayName: string;
    role: Role;
    active?: boolean;
    defaultLocationId?: number | null;
    defaultDepartmentId?: number | null;
  }
): Promise<UserRow> {
  const result = await db
    .prepare(
      `INSERT INTO users (email, display_name, role, active, default_location_id, default_department_id)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .bind(
      data.email.toLowerCase().trim(),
      data.displayName.trim(),
      data.role,
      data.active !== false ? 1 : 0,
      data.defaultLocationId || null,
      data.defaultDepartmentId || null
    )
    .first<UserRow>();

  if (!result) throw new Error("Échec de la création de l'utilisateur.");
  return result;
}

export async function updateUser(
  db: D1Database,
  userId: number,
  data: {
    displayName?: string;
    role?: Role;
    active?: boolean;
    defaultLocationId?: number | null;
    defaultDepartmentId?: number | null;
  }
): Promise<UserRow | null> {
  const updates: string[] = [];
  const binds: (string | number | null)[] = [];

  if (data.displayName !== undefined) {
    updates.push("display_name = ?");
    binds.push(data.displayName.trim());
  }
  if (data.role !== undefined) {
    updates.push("role = ?");
    binds.push(data.role);
  }
  if (data.active !== undefined) {
    updates.push("active = ?");
    binds.push(data.active ? 1 : 0);
  }
  if (data.defaultLocationId !== undefined) {
    updates.push("default_location_id = ?");
    binds.push(data.defaultLocationId || null);
  }
  if (data.defaultDepartmentId !== undefined) {
    updates.push("default_department_id = ?");
    binds.push(data.defaultDepartmentId || null);
  }

  if (updates.length === 0) {
    return db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<UserRow>();
  }

  updates.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  binds.push(userId);

  return db
    .prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...binds)
    .first<UserRow>();
}

// ----------------------------------------------------
// Référentiels génériques
// ----------------------------------------------------

export interface GenericReferenceRow {
  id: number;
  code: string;
  label: string;
  sort_order: number;
  active: number;
  category_id?: number | null; // pour subcategories
}

export function mapGenericReferenceRow(row: GenericReferenceRow): ApiReferenceItem {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    sortOrder: row.sort_order,
    active: Boolean(row.active),
    parentId: row.category_id !== undefined ? row.category_id : null,
  };
}

export async function listReferenceTable(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types" | "subcategories"
): Promise<GenericReferenceRow[]> {
  const query = `SELECT * FROM ${tableName} ORDER BY sort_order ASC, id ASC`;
  const result = await db.prepare(query).all<GenericReferenceRow>();
  return result.results || [];
}

export async function insertSimpleReference(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types",
  data: { code: string; label: string; sortOrder?: number }
): Promise<GenericReferenceRow> {
  const result = await db
    .prepare(
      `INSERT INTO ${tableName} (code, label, sort_order, active)
       VALUES (?, ?, ?, 1)
       RETURNING *`
    )
    .bind(data.code.trim(), data.label.trim(), data.sortOrder ?? 100)
    .first<GenericReferenceRow>();

  if (!result) throw new Error(`Échec de la création dans ${tableName}.`);
  return result;
}

export async function updateSimpleReference(
  db: D1Database,
  tableName: "locations" | "departments" | "categories" | "impact_types",
  id: number,
  data: { label?: string; sortOrder?: number; active?: boolean }
): Promise<GenericReferenceRow | null> {
  const updates: string[] = [];
  const binds: (string | number)[] = [];

  if (data.label !== undefined) {
    updates.push("label = ?");
    binds.push(data.label.trim());
  }
  if (data.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    binds.push(data.sortOrder);
  }
  if (data.active !== undefined) {
    updates.push("active = ?");
    binds.push(data.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).bind(id).first<GenericReferenceRow>();
  }

  binds.push(id);
  return db
    .prepare(`UPDATE ${tableName} SET ${updates.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...binds)
    .first<GenericReferenceRow>();
}

export async function insertSubcategory(
  db: D1Database,
  data: { categoryId: number; code: string; label: string; sortOrder?: number }
): Promise<GenericReferenceRow> {
  const result = await db
    .prepare(
      `INSERT INTO subcategories (category_id, code, label, sort_order, active)
       VALUES (?, ?, ?, ?, 1)
       RETURNING *`
    )
    .bind(data.categoryId, data.code.trim(), data.label.trim(), data.sortOrder ?? 100)
    .first<GenericReferenceRow>();

  if (!result) throw new Error("Échec de la création de la sous-catégorie.");
  return result;
}

export async function updateSubcategory(
  db: D1Database,
  id: number,
  data: { categoryId?: number; label?: string; sortOrder?: number; active?: boolean }
): Promise<GenericReferenceRow | null> {
  const updates: string[] = [];
  const binds: (string | number)[] = [];

  if (data.categoryId !== undefined) {
    updates.push("category_id = ?");
    binds.push(data.categoryId);
  }
  if (data.label !== undefined) {
    updates.push("label = ?");
    binds.push(data.label.trim());
  }
  if (data.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    binds.push(data.sortOrder);
  }
  if (data.active !== undefined) {
    updates.push("active = ?");
    binds.push(data.active ? 1 : 0);
  }

  if (updates.length === 0) {
    return db.prepare("SELECT * FROM subcategories WHERE id = ?").bind(id).first<GenericReferenceRow>();
  }

  binds.push(id);
  return db
    .prepare(`UPDATE subcategories SET ${updates.join(", ")} WHERE id = ? RETURNING *`)
    .bind(...binds)
    .first<GenericReferenceRow>();
}
