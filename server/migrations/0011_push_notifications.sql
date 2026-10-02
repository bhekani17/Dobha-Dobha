-- Phones that get push notifications (Firebase Cloud Messaging). A token belongs to one
-- signed-in account at a time; signing in elsewhere on the same phone moves it.
CREATE TABLE device_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX device_tokens_user ON device_tokens(user_id);

-- Set once a notification or chat message has been pushed (or skipped), so each goes out once.
ALTER TABLE notifications ADD COLUMN pushed_at INTEGER;
ALTER TABLE messages ADD COLUMN pushed_at INTEGER;
UPDATE notifications SET pushed_at = created_at;
UPDATE messages SET pushed_at = created_at;
CREATE INDEX notifications_unpushed ON notifications(pushed_at) WHERE pushed_at IS NULL;
CREATE INDEX messages_unpushed ON messages(pushed_at) WHERE pushed_at IS NULL;
