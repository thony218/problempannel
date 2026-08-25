ALTER TABLE issues
ADD COLUMN error_actor_user_id INTEGER REFERENCES users(id);

CREATE INDEX idx_issues_error_actor_subcategory
ON issues(error_actor_user_id, subcategory_id, occurred_on DESC);

-- Dernier rempart transactionnel contre deux téléversements concurrents.
-- La vérification applicative seule laisse une fenêtre entre COUNT et INSERT.
CREATE TRIGGER attachments_active_limit_before_insert
BEFORE INSERT ON attachments
WHEN (
  SELECT COUNT(*)
  FROM attachments
  WHERE issue_id = NEW.issue_id AND deleted_at IS NULL
) >= 10
BEGIN
  SELECT RAISE(ABORT, 'ATTACHMENT_LIMIT_REACHED');
END;
