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

export interface DirectoryUser {
  id: number;
  displayName: string;
  role: UserRole;
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

/**
 * Valide qu'un id de référence utilisateur soumis par un client
 * (ownerUserId, waitingOn.userId) existe bien et est actif, même règle
 * que findActiveReferenceById pour les référentiels (G-010).
 */
export async function findActiveUserById(db: D1Database, id: number): Promise<AppUser | null> {
  const row = await db
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? AND active = 1`)
    .bind(id)
    .first<UserRow>();
  return row ? mapUserRow(row) : null;
}

/**
 * Annuaire interne sûr pour les sélecteurs et les libellés historiques.
 * Inclut les comptes inactifs afin qu'une ancienne attribution garde un nom,
 * mais n'expose jamais le courriel ni les localisations par défaut.
 */
export async function listUserDirectory(db: D1Database): Promise<DirectoryUser[]> {
  const result = await db
    .prepare(
      `SELECT id, display_name, role, active
       FROM users
       ORDER BY active DESC, display_name COLLATE NOCASE ASC, id ASC`
    )
    .all<{ id: number; display_name: string; role: UserRole; active: number }>();

  return (result.results || []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    active: row.active === 1,
  }));
}
