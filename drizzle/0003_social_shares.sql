CREATE TABLE "social_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"url" text NOT NULL,
	"url_normalized" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "social_shares_url_normalized_unique" UNIQUE("url_normalized")
);
--> statement-breakpoint
ALTER TABLE "credit_entries" ADD COLUMN "social_share_id" uuid;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "social_shares_user_platform_live_uq" ON "social_shares" USING btree ("user_id","platform") WHERE status IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "social_shares_status_idx" ON "social_shares" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_share_reward_uq" ON "credit_entries" USING btree ("social_share_id") WHERE type = 'social_share_reward';--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_share_clawback_uq" ON "credit_entries" USING btree ("social_share_id") WHERE type = 'social_share_clawback';