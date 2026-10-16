-- Each listing can have several photos and videos, shown in `position` order.
CREATE TABLE item_media (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  media_key TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX item_media_item ON item_media(item_id, position);

-- Carry over the single photo existing listings already have.
INSERT INTO item_media (id, item_id, kind, media_key, position)
SELECT 'med_' || lower(hex(randomblob(10))), id, 'image', photo_key, 0 FROM items WHERE photo_key IS NOT NULL;
