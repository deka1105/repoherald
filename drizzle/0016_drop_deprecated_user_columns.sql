CREATE TABLE "credit_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_id" uuid NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "credit_purchases_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "issue_reports" (
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
CREATE TABLE "repo_comments" (
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
CREATE TABLE "repo_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"added_by_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_lists" (
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
ALTER TABLE "credit_entries" ADD COLUMN "credit_purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_entries" ADD COLUMN "issue_report_id" uuid;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_pack_id_credit_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."credit_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_comments" ADD CONSTRAINT "repo_comments_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_likes" ADD CONSTRAINT "repo_likes_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_likes" ADD CONSTRAINT "repo_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_list_id_repo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."repo_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_list_items" ADD CONSTRAINT "repo_list_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_lists" ADD CONSTRAINT "repo_lists_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_packs_active_sort_idx" ON "credit_packs" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX "credit_purchases_user_idx" ON "credit_purchases" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_purchases_intent_idx" ON "credit_purchases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "issue_reports_status_eligible_idx" ON "issue_reports" USING btree ("status","eligible_at");--> statement-breakpoint
CREATE INDEX "issue_reports_user_created_idx" ON "issue_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "repo_comments_repo_created_idx" ON "repo_comments" USING btree ("repo_id","created_at");--> statement-breakpoint
CREATE INDEX "repo_comments_status_created_idx" ON "repo_comments" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_likes_repo_user_uq" ON "repo_likes" USING btree ("repo_id","user_id");--> statement-breakpoint
CREATE INDEX "repo_likes_repo_idx" ON "repo_likes" USING btree ("repo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_list_items_pair_uq" ON "repo_list_items" USING btree ("list_id","repo_id");--> statement-breakpoint
CREATE INDEX "repo_list_items_list_idx" ON "repo_list_items" USING btree ("list_id","created_at");--> statement-breakpoint
CREATE INDEX "repo_lists_owner_idx" ON "repo_lists" USING btree ("owner_user_id","created_at");--> statement-breakpoint
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_credit_purchase_id_credit_purchases_id_fk" FOREIGN KEY ("credit_purchase_id") REFERENCES "public"."credit_purchases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_path_idx" ON "analytics_events" USING btree ("path");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_purchase_uq" ON "credit_entries" USING btree ("credit_purchase_id") WHERE type = 'purchase';--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_purchase_refund_uq" ON "credit_entries" USING btree ("credit_purchase_id") WHERE type = 'purchase_refund';--> statement-breakpoint
CREATE UNIQUE INDEX "credit_entries_issue_reward_uq" ON "credit_entries" USING btree ("issue_report_id") WHERE type = 'issue_report_reward';--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "daily_mint_count";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "daily_mint_date";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_admin";