-- Pieces a shopper plans to buy together.
CREATE TABLE cart_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

-- Price offers. The seller accepts, declines or counters; the buyer can accept a counter.
-- An accepted offer lets that buyer buy the piece at amount_cents until expires_at.
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'cancelled', 'used')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX offers_buyer ON offers(buyer_id, updated_at DESC);
CREATE INDEX offers_seller ON offers(seller_id, updated_at DESC);
CREATE INDEX offers_item ON offers(item_id);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, seller_id)
);
CREATE INDEX follows_seller ON follows(seller_id);

-- Direct messages between two users, optionally about one listing.
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX messages_pair ON messages(sender_id, recipient_id, created_at);
CREATE INDEX messages_recipient ON messages(recipient_id, read_at);

-- One review per completed order, written by the buyer.
CREATE TABLE reviews (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX reviews_seller ON reviews(seller_id, created_at DESC);
