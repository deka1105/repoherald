CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"path" text,
	"repo_id" uuid,
	"user_id" uuid,
	"visitor_id" text NOT NULL,
	"referrer_host" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_type_created_idx" ON "analytics_events" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_repo_type_idx" ON "analytics_events" USING btree ("repo_id","type");--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");
