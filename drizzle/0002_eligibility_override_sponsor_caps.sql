ALTER TABLE "sponsorships" ADD COLUMN "stars_cap" integer;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD COLUMN "stars_at_start" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "eligibility_override" text;