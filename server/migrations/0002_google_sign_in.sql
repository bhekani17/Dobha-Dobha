-- Google accounts are linked by Google's stable user id ("sub").
-- Google-only users have an empty password_hash and cannot use password login.
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;
