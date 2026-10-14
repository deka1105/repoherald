CREATE TABLE "ingest_repo_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_repo_id" bigint,
	"full_name" text NOT NULL,
	"owner_login" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"primary_language" text,
	"stars_count" integer DEFAULT 0 NOT NULL,
	"avatar_url" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"promoted_repo_id" uuid,
	CONSTRAINT "ingest_repo_candidates_github_repo_id_unique" UNIQUE("github_repo_id"),
	CONSTRAINT "ingest_repo_candidates_full_name_unique" UNIQUE("full_name")
);
--> statement-breakpoint
CREATE TABLE "ingest_sightings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"post_url" text NOT NULL,
	"shortcode" text,
	"sender_username" text,
	"poster_username" text,
	"message_ts" timestamp with time zone,
	"found_in" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_repo_candidates" ADD CONSTRAINT "ingest_repo_candidates_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_repo_candidates" ADD CONSTRAINT "ingest_repo_candidates_promoted_repo_id_repos_id_fk" FOREIGN KEY ("promoted_repo_id") REFERENCES "public"."repos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_sightings" ADD CONSTRAINT "ingest_sightings_candidate_id_ingest_repo_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."ingest_repo_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingest_candidates_status_idx" ON "ingest_repo_candidates" USING btree ("status","discovered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_sightings_unique" ON "ingest_sightings" USING btree ("candidate_id","post_url","sender_username");--> statement-breakpoint
CREATE INDEX "ingest_sightings_sender_idx" ON "ingest_sightings" USING btree ("sender_username");