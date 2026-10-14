ALTER TABLE "users" ALTER COLUMN "github_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "github_login" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_lists" ADD COLUMN "visibility" text DEFAULT 'unlisted' NOT NULL;--> statement-breakpoint
ALTER TABLE "repo_lists" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "instagram_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tiktok_username" text;--> statement-breakpoint
CREATE UNIQUE INDEX "repo_lists_owner_source_uq" ON "repo_lists" USING btree ("owner_user_id","source") WHERE source <> 'manual';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_instagram_username_unique" UNIQUE("instagram_username");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tiktok_username_unique" UNIQUE("tiktok_username");