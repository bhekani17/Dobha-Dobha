-- "Forgot password": one emailed 6-digit code per account at a time, stored only as a hash.
-- sent_count / window_start cap how many codes go out per hour; attempts caps guesses per code.
CREATE TABLE password_resets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);

-- Deleted accounts are anonymised rather than removed, so the other side's orders,
-- messages and reviews still have someone to point at.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
