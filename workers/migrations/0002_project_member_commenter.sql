ALTER TABLE project_members RENAME TO project_members_old;

CREATE TABLE project_members (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'commenter', 'viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, user_id)
);

INSERT INTO project_members (project_id, user_id, role, created_at)
SELECT project_id, user_id, role, created_at
FROM project_members_old;

DROP TABLE project_members_old;

CREATE INDEX idx_project_members_user ON project_members(user_id);
