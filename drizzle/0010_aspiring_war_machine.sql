-- Adds users.role (user | moderator | admin), backfilled from is_admin.
-- is_admin stays for now so the deploy running during the migration window
-- keeps working; drop it in a later migration once role is everywhere.
--
-- drizzle-kit generate also emitted CREATE TABLE/INDEX statements for the
-- 0006-0008 snapshot gap (analytics_events, sponsor_plans, discount_*);
-- those objects already exist in production, so — following the 0009
-- reconcile pattern — they are omitted here and this file is idempotent.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
UPDATE "users" SET "role" = 'admin' WHERE "is_admin" AND "role" = 'user';
