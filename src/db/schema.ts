import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  githubLogin: text("github_login").notNull(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  githubAccessTokenEnc: text("github_access_token_enc"),
  tokenInvalidAt: timestamp("token_invalid_at", { withTimezone: true }),
  githubCreatedAt: timestamp("github_created_at", { withTimezone: true }),
  githubPublicRepos: integer("github_public_repos"),
  githubFollowers: integer("github_followers"),
  mintEligible: boolean("mint_eligible").notNull().default(false),
  dailyMintCount: integer("daily_mint_count").notNull().default(0),
  dailyMintDate: date("daily_mint_date"),
  isAdmin: boolean("is_admin").notNull().default(false),
  // Cache of SUM(credit_entries.delta); ledger is source of truth. May go negative (clawback debt).
  creditBalance: integer("credit_balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const repos = pgTable(
  "repos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull().unique(),
    fullName: text("full_name").notNull(),
    ownerLogin: text("owner_login").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    primaryLanguage: text("primary_language"),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    starsCount: integer("stars_count").notNull().default(0),
    avatarUrl: text("avatar_url"),
    isArchived: boolean("is_archived").notNull().default(false),
    postedByUserId: uuid("posted_by_user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["active", "hidden", "removed"] })
      .notNull()
      .default("active"),
    removedReason: text("removed_reason"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("repos_status_created_idx").on(t.status, t.createdAt)]
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: ["use_case", "sector"] }).notNull(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_kind_slug_uq").on(t.kind, t.slug)]
);

export const repoCategories = pgTable(
  "repo_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("repo_categories_pair_uq").on(t.repoId, t.categoryId),
    index("repo_categories_category_idx").on(t.categoryId),
  ]
);

// Permanent anti-gaming ledger: rows are never deleted. A revoked row still
// blocks re-minting for the same (user, repo) forever.
export const starMints = pgTable(
  "star_mints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id),
    githubRepoId: bigint("github_repo_id", { mode: "number" }).notNull(),
    mintedAt: timestamp("minted_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    status: text("status", { enum: ["minted", "revoked", "frozen"] })
      .notNull()
      .default("minted"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("star_mints_user_repo_uq").on(t.userId, t.repoId),
    index("star_mints_reverify_idx").on(t.status, t.lastVerifiedAt),
  ]
);

export const creditEntries = pgTable(
  "credit_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    delta: integer("delta").notNull(),
    type: text("type", {
      enum: [
        "mint",
        "spend_self_highlight",
        "spend_donation",
        "revocation_clawback",
        "highlight_cancellation_refund",
        "credit_expiry",
        "admin_adjustment",
      ],
    }).notNull(),
    starMintId: uuid("star_mint_id").references(() => starMints.id),
    highlightId: uuid("highlight_id"),
    adminUserId: uuid("admin_user_id").references(() => users.id),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One mint entry and at most one clawback per star, ever.
    uniqueIndex("credit_entries_mint_uq")
      .on(t.starMintId)
      .where(sql`type = 'mint'`),
    uniqueIndex("credit_entries_clawback_uq")
      .on(t.starMintId)
      .where(sql`type = 'revocation_clawback'`),
    index("credit_entries_user_idx").on(t.userId, t.createdAt),
  ]
);

export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id),
    purchasedByUserId: uuid("purchased_by_user_id")
      .notNull()
      .references(() => users.id),
    source: text("source", { enum: ["self", "donation", "admin"] }).notNull(),
    creditEntryId: uuid("credit_entry_id").references(() => creditEntries.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    minutesTotal: integer("minutes_total").notNull(),
    // Reporting-only; live status is always derived from timestamps in queries.
    status: text("status", {
      enum: ["scheduled", "active", "completed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("highlights_repo_ends_idx").on(t.repoId, t.endsAt),
    index("highlights_status_starts_idx").on(t.status, t.startsAt),
  ]
);

export const sponsorships = pgTable(
  "sponsorships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id),
    sponsorUserId: uuid("sponsor_user_id").references(() => users.id),
    sponsorName: text("sponsor_name"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    durationDays: integer("duration_days"),
    status: text("status", {
      enum: ["pending_payment", "active", "expired", "cancelled"],
    })
      .notNull()
      .default("pending_payment"),
    createdVia: text("created_via", { enum: ["stripe", "admin"] }).notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePriceId: text("stripe_price_id"),
    amountCents: integer("amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // At most one live (pending or active) sponsorship per repo.
    uniqueIndex("sponsorships_repo_live_uq")
      .on(t.repoId)
      .where(sql`status IN ('pending_payment', 'active')`),
    index("sponsorships_status_ends_idx").on(t.status, t.endsAt),
  ]
);

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorType: text("actor_type", {
      enum: ["user", "admin", "system", "stripe"],
    }).notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)]
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id),
    reporterUserId: uuid("reporter_user_id").references(() => users.id),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)]
);
