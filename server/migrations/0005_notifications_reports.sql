-- Orders gain a 'refunded' outcome for disputes settled in the buyer's favour.
-- SQLite can't change a CHECK constraint in place, so the table is rebuilt.
CREATE TABLE orders_new (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id),
  buyer_id TEXT NOT NULL REFERENCES users(id),
  seller_id TEXT NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL,
  delivery_method TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paymentHeld', 'vendorDispatched', 'payoutReleased', 'disputed', 'refunded')),
  vault_ref TEXT NOT NULL,
  tracking TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  dispatched_at INTEGER,
  confirmed_at INTEGER
);
INSERT INTO orders_new SELECT * FROM orders;
DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;
CREATE INDEX orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX orders_seller ON orders(seller_id, created_at DESC);
CREATE INDEX orders_status ON orders(status);

-- Tracking numbers were generated before; the seller now enters the real one on dispatch.
UPDATE orders SET tracking = '' WHERE status = 'paymentHeld' AND tracking LIKE 'PUDO-ZA-%';

-- In-app notifications (sales, dispatches, payouts, disputes, comments).
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  order_id TEXT,
  item_id TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, created_at DESC);

-- A user can report a listing once.
CREATE TABLE reports (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (item_id, user_id)
);

-- Every upload, so ones never attached to a listing can be cleaned up.
CREATE TABLE uploads (
  media_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX uploads_created ON uploads(created_at);
