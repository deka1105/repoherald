-- A Postgres role for repoHeraldIG, scoped to the ingest tables only.
--
-- Why not just hand it DATABASE_URL: that connection owns everything. It can
-- UPDATE credit_entries, read every user's email, and DELETE repos. The thing
-- on the other end is a scraper driving a headless browser against Instagram —
-- the single most compromisable component in the system. It needs to append
-- rows to two tables and nothing else.
--
-- Run once, as the database owner:
--     psql "$DATABASE_URL" -v pw="$(openssl rand -base64 24)" -f scripts/ingest-role.sql
--
-- Then give repoHeraldIG a connection string built with this role, exported as
-- REPOHERALD_DATABASE_URL. Never the app's own DATABASE_URL.

\set pw :pw

CREATE ROLE heraldig_ingest WITH LOGIN PASSWORD :'pw';

-- Connect and see the schema, nothing more.
GRANT CONNECT ON DATABASE neondb TO heraldig_ingest;
GRANT USAGE ON SCHEMA public TO heraldig_ingest;

-- Append and read its own candidates; update only to correct metadata it wrote.
GRANT SELECT, INSERT, UPDATE ON ingest_repo_candidates TO heraldig_ingest;
GRANT SELECT, INSERT ON ingest_sightings TO heraldig_ingest;

-- Explicitly NOT granted, and worth stating so a later reader does not "fix" it:
--   * DELETE on either table — removal is a moderator action in the app.
--   * Any access to users, repos, credit_entries, star_mints, sponsorships.
--   * Promotion. `promoted_repo_id` and `reviewed_by_user_id` are written by
--     repoherald when a human acts, never by the scraper.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM heraldig_ingest;
GRANT SELECT, INSERT, UPDATE ON ingest_repo_candidates TO heraldig_ingest;
GRANT SELECT, INSERT ON ingest_sightings TO heraldig_ingest;

-- New tables added later must not silently become readable by this role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM heraldig_ingest;
