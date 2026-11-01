ALTER TABLE "analytics_events" ADD COLUMN "country" text;--> statement-breakpoint
CREATE INDEX "analytics_events_country_idx" ON "analytics_events" USING btree ("country","created_at");