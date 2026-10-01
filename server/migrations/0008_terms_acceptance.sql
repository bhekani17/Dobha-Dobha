-- Which version of the Terms and Conditions each account accepted, and when.
-- Accounts from before terms existed have NULL until they accept a version.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER;
