-- "Contact support": questions and problems sent from the app, answered from the admin website.
-- user_id is null when someone who can't log in writes in; replies then go to `email`.
CREATE TABLE support_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  order_id TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | answered | closed
  reply TEXT,
  replied_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX support_requests_user ON support_requests(user_id, created_at);
CREATE INDEX support_requests_status ON support_requests(status, created_at);
