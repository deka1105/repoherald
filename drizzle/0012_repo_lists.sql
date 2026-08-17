-- Shareable, collaborative repo lists.
-- Hand-written and idempotent: the drizzle meta snapshots have a gap (0006–0008)
-- so diff-based generation is unusable here (same as 0009–0011).

CREATE TABLE IF NOT EXISTS "repo_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "contributions" text DEFAULT 'open' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "repo_lists_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "repo_list_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL,
  "repo_id" uuid NOT NULL,
  "added_by_user_id" uuid NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_lists" ADD CONSTRAINT "repo_lists_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_list_id_repo_lists_id_fk"
    FOREIGN KEY ("list_id") REFERENCES "public"."repo_lists"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_repo_id_repos_id_fk"
    FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_added_by_user_id_users_id_fk"
    FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "repo_lists_owner_idx" ON "repo_lists" ("owner_user_id","created_at");
--> statement-breakpoint
-- A repo appears at most once per list; concurrent adds collide here rather
-- than duplicating a row.
CREATE UNIQUE INDEX IF NOT EXISTS "repo_list_items_pair_uq" ON "repo_list_items" ("list_id","repo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "repo_list_items_list_idx" ON "repo_list_items" ("list_id","created_at");
