-- Drop three dead columns on `users`. All three were superseded and are read
-- by nothing; verified against production before dropping:
--
--   is_admin         -> superseded by `role`. Checked for divergence first:
--                       zero rows where is_admin disagreed with role, so the
--                       column carried no access grant that `role` lacked.
--   daily_mint_count -> superseded by counting mints in credit_entries
--   daily_mint_date     (getClaimUsage in src/lib/credits.ts), which is the
--                       source of truth and retains the full history.
--
-- NOTE ON ORDERING: this is a DROP, so it is the mirror image of an ADD. The
-- code that stopped selecting these columns must be DEPLOYED FIRST — Drizzle
-- enumerates columns explicitly in select(), so dropping them while an older
-- deployment is still live turns every users query into
-- "column does not exist" and 500s the site.
--
-- IF NOT EXISTS so re-running is harmless (matches 0012-0015, which are
-- hand-written idempotent SQL rather than drizzle-kit output).
ALTER TABLE "users" DROP COLUMN IF EXISTS "daily_mint_count";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "daily_mint_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin";
