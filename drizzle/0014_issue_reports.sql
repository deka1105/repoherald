-- Issue-report rewards: pending credits that settle after a 7-day window.
-- Hand-written and idempotent, same as 0009–0013.

CREATE TABLE IF NOT EXISTS "issue_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "repo_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "github_issue_id" bigint NOT NULL,
  "issue_number" integer NOT NULL,
  "issue_url" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "eligible_at" timestamp with time zone NOT NULL,
  "validated_at" timestamp with time zone,
  "rejected_reason" text,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "issue_reports_github_issue_id_unique" UNIQUE("github_issue_id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_repo_id_repos_id_fk"
    FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "issue_reports_status_eligible_idx" ON "issue_reports" ("status","eligible_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issue_reports_user_created_idx" ON "issue_reports" ("user_id","created_at");
--> statement-breakpoint

-- Ledger link. No FK on purpose: credit_entries is append-only history and must
-- never be blocked by (or cascade from) a report row.
ALTER TABLE "credit_entries" ADD COLUMN IF NOT EXISTS "issue_report_id" uuid;
--> statement-breakpoint

-- One reward per validated report, so a cron retry can't pay twice.
CREATE UNIQUE INDEX IF NOT EXISTS "credit_entries_issue_reward_uq"
  ON "credit_entries" ("issue_report_id") WHERE type = 'issue_report_reward';
