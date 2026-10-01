-- How many of a piece the seller has left (e.g. 10 identical skirts). Each order buys one;
-- the listing shows as sold when it reaches 0.
ALTER TABLE items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0);
UPDATE items SET quantity = 0 WHERE status = 'sold';
