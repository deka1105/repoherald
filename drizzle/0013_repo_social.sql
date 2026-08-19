-- Likes and comments on repos.
-- Hand-written and idempotent, same as 0009–0012 (the drizzle meta snapshots
-- have a 0006–0008 gap, so diff-based generation is unusable here).

CREATE TABLE IF NOT EXISTS "repo_likes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "repo_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "body" text NOT NULL,
  "status" text DEFAULT 'visible' NOT NULL,
  "removed_by_user_id" uuid,
  "removed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_likes" ADD CONSTRAINT "repo_likes_repo_id_repos_id_fk"
    FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_likes" ADD CONSTRAINT "repo_likes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_repo_id_repos_id_fk"
    FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_removed_by_user_id_users_id_fk"
    FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- One like per person per repo: a double-click can't double-count, and the
-- toggle can rely on the conflict instead of a read-then-write race.
CREATE UNIQUE INDEX IF NOT EXISTS "repo_likes_repo_user_uq" ON "repo_likes" ("repo_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_likes_repo_idx" ON "repo_likes" ("repo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_comments_repo_created_idx" ON "repo_comments" ("repo_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_comments_status_created_idx" ON "repo_comments" ("status","created_at");
