export type UserRole = "employee" | "manager" | "admin";

export interface AppUser {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  defaultLocationId: number | null;
  defaultDepartmentId: number | null;
  active: boolean;
}

interface UserRow {
  id: number;
  email: string;
  display_name: string;
  role: string;
  default_location_id: number | null;
  default_department_id: number | null;
  active: number;
}

function mapUserRow(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as UserRole,
    defaultLocationId: row.default_location_id,
    defaultDepartmentId: row.default_department_id,
    active: row.active === 1,
  };
}

const USER_COLUMNS =
  "id, email, display_name, role, default_location_id, default_department_id, active";

export async function findUserByEmail(db: D1Database, email: string): Promise<AppUser | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`)
    .bind(email)
    .first<UserRow>();
  return row ? mapUserRow(row) : null;
}
