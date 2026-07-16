-- Credit packs: buy credits for cash. Hand-written idempotent DDL (the meta
-- snapshots have a 0006-0008 gap, so drizzle-kit diffing is unusable — same
-- approach as 0009/0010). credit_entries.type needs no DDL (plain text).
CREATE TABLE IF NOT EXISTS "credit_packs" (
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
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_purchases" (
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
);--> statement-breakpoint
ALTER TABLE "credit_entries" ADD COLUMN IF NOT EXISTS "credit_purchase_id" uuid;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_pack_id_credit_packs_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."credit_packs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_credit_purchase_id_credit_purchases_id_fk" FOREIGN KEY ("credit_purchase_id") REFERENCES "public"."credit_purchases"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_packs_active_sort_idx" ON "credit_packs" USING btree ("active","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_purchases_user_idx" ON "credit_purchases" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_purchases_intent_idx" ON "credit_purchases" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_entries_purchase_uq" ON "credit_entries" USING btree ("credit_purchase_id") WHERE type = 'purchase';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_entries_purchase_refund_uq" ON "credit_entries" USING btree ("credit_purchase_id") WHERE type = 'purchase_refund';--> statement-breakpoint
INSERT INTO "credit_packs" ("key", "label", "credits", "amount_cents", "sort_order") VALUES
	('starter', 'Starter', 10, 1200, 0),
	('builder', 'Builder', 30, 2900, 1),
	('scale', 'Scale', 100, 7900, 2)
ON CONFLICT ("key") DO NOTHING;
