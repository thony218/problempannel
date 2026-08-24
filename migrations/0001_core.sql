PRAGMA foreign_keys = ON;

CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE subcategories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(category_id, code)
);

CREATE TABLE impact_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee','manager','admin')),
  default_location_id INTEGER REFERENCES locations(id),
  default_department_id INTEGER REFERENCES departments(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_on TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  row_version INTEGER NOT NULL DEFAULT 1 CHECK (row_version >= 1),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  location_id INTEGER NOT NULL REFERENCES locations(id),
  department_id INTEGER REFERENCES departments(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  subcategory_id INTEGER REFERENCES subcategories(id),
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal','important','urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','waiting','resolved')),
  owner_user_id INTEGER REFERENCES users(id),
  due_date TEXT,
  cause_status TEXT CHECK (cause_status IS NULL OR cause_status IN ('to_verify','known')),
  cause_summary TEXT,
  immediate_solution TEXT,
  permanent_correction_type TEXT CHECK (
    permanent_correction_type IS NULL OR permanent_correction_type IN (
      'procedure_update','new_procedure','training','system_configuration',
      'responsibility_change','additional_check','supplier_process',
      'no_change_required','other'
    )
  ),
  permanent_correction_summary TEXT,
  waiting_on_type TEXT CHECK (
    waiting_on_type IS NULL OR waiting_on_type IN ('user','customer','supplier','other')
  ),
  waiting_on_user_id INTEGER REFERENCES users(id),
  waiting_on_label TEXT,
  final_result TEXT,
  prevention_learning TEXT,
  effectiveness_status TEXT CHECK (
    effectiveness_status IS NULL OR effectiveness_status IN ('pending','effective','ineffective')
  ),
  effectiveness_review_date TEXT,
  resolved_at TEXT,
  resolved_by_user_id INTEGER REFERENCES users(id),
  redacted_at TEXT,
  redacted_by_user_id INTEGER REFERENCES users(id),
  redaction_reason TEXT,
  CHECK (status = 'new' OR subcategory_id IS NOT NULL),
  CHECK (
    (status <> 'waiting' AND waiting_on_type IS NULL AND waiting_on_user_id IS NULL AND waiting_on_label IS NULL)
    OR
    (
      status = 'waiting'
      AND (
        (waiting_on_type = 'user' AND waiting_on_user_id IS NOT NULL AND waiting_on_label IS NULL)
        OR
        (waiting_on_type IN ('customer','supplier','other') AND waiting_on_user_id IS NULL AND waiting_on_label IS NOT NULL AND length(trim(waiting_on_label)) > 0)
      )
    )
  ),
  CHECK (
    (redacted_at IS NULL AND redacted_by_user_id IS NULL AND redaction_reason IS NULL)
    OR
    (redacted_at IS NOT NULL AND redacted_by_user_id IS NOT NULL AND redaction_reason IS NOT NULL AND length(trim(redaction_reason)) >= 5)
  )
);

CREATE TABLE issue_impacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  impact_type_id INTEGER NOT NULL REFERENCES impact_types(id),
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(issue_id, impact_type_id)
);

CREATE TABLE corrective_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id),
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','waiting','done')),
  blocks_issue_closure INTEGER NOT NULL DEFAULT 0 CHECK (blocks_issue_closure IN (0,1)),
  result TEXT,
  effectiveness_status TEXT CHECK (
    effectiveness_status IS NULL OR effectiveness_status IN ('pending','effective','ineffective')
  ),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  deleted_by_user_id INTEGER REFERENCES users(id),
  delete_reason TEXT,
  redacted_at TEXT,
  redacted_by_user_id INTEGER REFERENCES users(id),
  redaction_reason TEXT,
  CHECK (
    (deleted_at IS NULL AND deleted_by_user_id IS NULL AND delete_reason IS NULL)
    OR
    (deleted_at IS NOT NULL AND deleted_by_user_id IS NOT NULL AND delete_reason IS NOT NULL)
  ),
  CHECK (
    (redacted_at IS NULL AND redacted_by_user_id IS NULL AND redaction_reason IS NULL)
    OR
    (redacted_at IS NOT NULL AND redacted_by_user_id IS NOT NULL AND redaction_reason IS NOT NULL AND length(trim(redaction_reason)) >= 5)
  )
);

CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id),
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  deleted_by_user_id INTEGER REFERENCES users(id),
  delete_reason TEXT
);

CREATE TABLE issue_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE issue_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id_a INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  issue_id_b INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL DEFAULT 'similar' CHECK (link_type IN ('similar')),
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (issue_id_a < issue_id_b),
  UNIQUE(issue_id_a, issue_id_b, link_type)
);

CREATE TABLE system_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_issues_status_created ON issues(status, created_at DESC, id DESC);
CREATE INDEX idx_issues_priority_status ON issues(priority, status);
CREATE INDEX idx_issues_location_created ON issues(location_id, created_at DESC);
CREATE INDEX idx_issues_department_created ON issues(department_id, created_at DESC);
CREATE INDEX idx_issues_category_created ON issues(category_id, created_at DESC);
CREATE INDEX idx_issues_subcategory_created ON issues(subcategory_id, created_at DESC);
CREATE INDEX idx_issues_owner_status ON issues(owner_user_id, status);
CREATE INDEX idx_issues_due_status ON issues(due_date, status);
CREATE INDEX idx_issues_effectiveness ON issues(effectiveness_status, effectiveness_review_date);
CREATE INDEX idx_issue_impacts_issue ON issue_impacts(issue_id);
CREATE INDEX idx_actions_issue ON corrective_actions(issue_id);
CREATE INDEX idx_actions_owner_status ON corrective_actions(owner_user_id, status);
CREATE INDEX idx_actions_due_status ON corrective_actions(due_date, status);
CREATE INDEX idx_comments_issue_created ON comments(issue_id, created_at, id);
CREATE INDEX idx_attachments_issue ON attachments(issue_id, created_at);
CREATE INDEX idx_history_issue_created ON issue_history(issue_id, created_at, id);
CREATE INDEX idx_links_a ON issue_links(issue_id_a);
CREATE INDEX idx_links_b ON issue_links(issue_id_b);
