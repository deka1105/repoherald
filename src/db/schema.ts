import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  integer,
  timestamp,
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
  // Admin override: 'allowed'/'blocked' beats the heuristic; null = heuristic.
  eligibilityOverride: text("eligibility_override", {
    enum: ["allowed", "blocked"],
  }),
  // Moderators get content/community tools (listings, reports, shares, support,
  // categories); money, credits, roles, and pricing stay admin-only.
  role: text("role", { enum: ["user", "moderator", "admin"] })
    .notNull()
    .default("user"),
  // Cache of SUM(credit_entries.delta); ledger is source of truth. May go negative (clawback debt).
  creditBalance: integer("credit_balance").notNull().default(0),
  // Ledger entries after this moment are "unseen" → surfaced as notifications.
  creditsSeenAt: timestamp("credits_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Opt-in: email me when a new sponsored repo goes live. Off by default (consent).
  sponsorAlertsOptIn: boolean("sponsor_alerts_opt_in").notNull().default(false),
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
        "social_share_reward",
        "social_share_clawback",
        "welcome_bonus",
        "purchase",
        "purchase_refund",
        "issue_report_reward",
      ],
    }).notNull(),
    starMintId: uuid("star_mint_id").references(() => starMints.id),
    socialShareId: uuid("social_share_id"),
    creditPurchaseId: uuid("credit_purchase_id").references(() => creditPurchases.id),
    issueReportId: uuid("issue_report_id"),
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
    uniqueIndex("credit_entries_share_reward_uq")
      .on(t.socialShareId)
      .where(sql`type = 'social_share_reward'`),
    uniqueIndex("credit_entries_share_clawback_uq")
      .on(t.socialShareId)
      .where(sql`type = 'social_share_clawback'`),
    // One welcome bonus per user, ever — guarantees the signup grant is
    // idempotent even under concurrent sign-ins.
    uniqueIndex("credit_entries_welcome_uq")
      .on(t.userId)
      .where(sql`type = 'welcome_bonus'`),
    // One grant and at most one refund clawback per credit-pack purchase, so
    // Stripe webhook retries can never double-credit or double-debit.
    uniqueIndex("credit_entries_purchase_uq")
      .on(t.creditPurchaseId)
      .where(sql`type = 'purchase'`),
    uniqueIndex("credit_entries_purchase_refund_uq")
      .on(t.creditPurchaseId)
      .where(sql`type = 'purchase_refund'`),
    // One reward per validated issue report, so a cron retry can't pay twice.
    uniqueIndex("credit_entries_issue_reward_uq")
      .on(t.issueReportId)
      .where(sql`type = 'issue_report_reward'`),
    index("credit_entries_user_idx").on(t.userId, t.createdAt),
  ]
);

// Social share rewards: one credit per platform once an admin approves the
// submitted post URL; the URL must stay live for 7 days or the reward is
// clawed back.
export const socialShares = pgTable(
  "social_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    platform: text("platform", {
      enum: ["reddit", "instagram", "facebook", "x", "tiktok"],
    }).notNull(),
    url: text("url").notNull(),
    urlNormalized: text("url_normalized").notNull().unique(),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "revoked"],
    })
      .notNull()
      .default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One live (pending/approved) submission per platform per user.
    uniqueIndex("social_shares_user_platform_live_uq")
      .on(t.userId, t.platform)
      .where(sql`status IN ('pending', 'approved')`),
    index("social_shares_status_idx").on(t.status, t.createdAt),
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
    // Sponsorship also ends when the repo gains this many stars ("7 days or
    // 75 stars, whichever first"). Null = time-only.
    starsCap: integer("stars_cap"),
    starsAtStart: integer("stars_at_start"),
    status: text("status", {
      enum: ["pending_payment", "active", "expired", "cancelled"],
    })
      .notNull()
      .default("pending_payment"),
    // "promo" = comped free via a 100%-off (or below-Stripe-minimum) discount code.
    createdVia: text("created_via", { enum: ["stripe", "admin", "promo"] }).notNull(),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripePriceId: text("stripe_price_id"),
    amountCents: integer("amount_cents"),
    // Discount applied at checkout (in-house engine, see src/lib/pricing.ts).
    discountCodeId: uuid("discount_code_id"),
    discountAmountCents: integer("discount_amount_cents"),
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
      enum: ["user", "moderator", "admin", "system", "stripe"],
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

// User-submitted support queries. Anyone can file one (email required); a
// logged-in user's id is attached so admins can see who asked.
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    email: text("email").notNull(),
    subject: text("subject"),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "resolved"] })
      .notNull()
      .default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_tickets_status_idx").on(t.status, t.createdAt)]
);

// First-party analytics fact table. Append-only. repo_id/user_id are plain
// UUIDs (NOT foreign keys) so this stays decoupled from the dimension tables:
// client-supplied ids can't raise FK errors, account deletion isn't blocked,
// and writes take no locks on repos/users. Joins happen in the admin queries.
// visitor_id is a cookieless daily-rotating hash (see src/lib/analytics.ts).
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type", {
      enum: [
        "page_view",
        "repo_view",
        "claim_click",
        "donate_click",
        "github_click",
      ],
    }).notNull(),
    path: text("path"),
    repoId: uuid("repo_id"),
    userId: uuid("user_id"),
    visitorId: text("visitor_id").notNull(),
    referrerHost: text("referrer_host"),
    // Traffic from signed-in admins, so KPIs can exclude self-visits.
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("analytics_events_type_created_idx").on(t.type, t.createdAt),
    index("analytics_events_repo_type_idx").on(t.repoId, t.type),
    index("analytics_events_created_idx").on(t.createdAt),
    // Per-page view counts (list pages) look up by path.
    index("analytics_events_path_idx").on(t.path),
  ]
);

// Admin-editable sponsorship plans. Replaces the old hardcoded SPONSOR_PRICES +
// STRIPE_PRICE_* env ids: Checkout now uses dynamic price_data from amountCents,
// so admins can change prices/caps without touching Stripe or redeploying.
export const sponsorPlans = pgTable(
  "sponsor_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    durationDays: integer("duration_days").notNull(),
    // Sponsorship also ends when the repo gains this many stars. Null = time-only.
    starsCap: integer("stars_cap"),
    amountCents: integer("amount_cents").notNull(),
    // Plan-level sale discount (0–100%). When > 0, the buyer pays the reduced
    // price and the UI shows the original struck through. Applied before any
    // discount code, which stacks on top of the reduced price.
    discountPercent: integer("discount_percent").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sponsor_plans_active_sort_idx").on(t.active, t.sortOrder)]
);

// Simple key→integer store for site-wide tunables (e.g. daily/weekly claim caps).
// Source of truth for star-claim limits; src/lib/credits.ts falls back to the
// exported defaults when a key is absent.
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: integer("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// In-house discount codes for sponsorship checkout. userId NULL = global code;
// otherwise the code only works for that one user. Redemptions are recorded in
// discount_redemptions on successful payment (or free comp).
export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(), // stored normalized (upper, trimmed)
    kind: text("kind", { enum: ["percent", "fixed"] }).notNull(),
    // percent: 1–100; fixed: amount off in cents.
    value: integer("value").notNull(),
    // Null = global; otherwise restricted to this user.
    userId: uuid("user_id").references(() => users.id),
    // Null = unlimited redemptions.
    maxRedemptions: integer("max_redemptions"),
    timesRedeemed: integer("times_redeemed").notNull().default(0),
    // Only applies when the pre-discount total is at least this many cents.
    minAmountCents: integer("min_amount_cents"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("discount_codes_active_idx").on(t.active)]
);

export const discountRedemptions = pgTable(
  "discount_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discountCodeId: uuid("discount_code_id")
      .notNull()
      .references(() => discountCodes.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    sponsorshipId: uuid("sponsorship_id").references(() => sponsorships.id),
    amountOffCents: integer("amount_off_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("discount_redemptions_code_idx").on(t.discountCodeId),
    // One redemption row per sponsorship, so webhook retries don't double-count.
    uniqueIndex("discount_redemptions_sponsorship_uq")
      .on(t.sponsorshipId)
      .where(sql`sponsorship_id IS NOT NULL`),
  ]
);

// Admin-editable credit bundles sold for cash (the "buy credits" SKU). Same
// model as sponsor_plans: Checkout uses dynamic price_data from amountCents,
// so admins change packs/prices live with no Stripe products and no redeploy.
export const creditPacks = pgTable(
  "credit_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    credits: integer("credits").notNull(),
    amountCents: integer("amount_cents").notNull(),
    // Pack-level sale discount (0–100%), same semantics as sponsor_plans. A
    // pack whose sale price falls below Stripe's minimum can't be bought (no
    // free-comp path here — that would mean unlimited free credits).
    discountPercent: integer("discount_percent").notNull().default(0),
    currency: text("currency").notNull().default("usd"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("credit_packs_active_sort_idx").on(t.active, t.sortOrder)]
);

// Bug-report rewards: a user files a GitHub issue on a listed repo and submits
// its URL here. Credits are NOT granted on submission — the row sits 'pending'
// until eligible_at (7 days later), when the cron re-reads the issue and pays
// out only if it hasn't been labelled invalid/duplicate/etc. in the meantime.
export const issueReports = pgTable(
  "issue_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    // GitHub's own issue id: unique, so one issue can never be rewarded twice
    // (nor claimed by a second account).
    githubIssueId: bigint("github_issue_id", { mode: "number" }).notNull().unique(),
    issueNumber: integer("issue_number").notNull(),
    issueUrl: text("issue_url").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    // Settling window: the cron ignores this row until now() >= eligible_at.
    eligibleAt: timestamp("eligible_at", { withTimezone: true }).notNull(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    rejectedReason: text("rejected_reason"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("issue_reports_status_eligible_idx").on(t.status, t.eligibleAt),
    index("issue_reports_user_created_idx").on(t.userId, t.createdAt),
  ]
);

// Lightweight engagement signal, separate from star_mints: a like costs
// nothing, mints no credit, and can be taken back (the row is deleted), so it
// carries none of the anti-gaming machinery stars do.
export const repoLikes = pgTable(
  "repo_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One like per person per repo; a double-click can't double-count.
    uniqueIndex("repo_likes_repo_user_uq").on(t.repoId, t.userId),
    index("repo_likes_repo_idx").on(t.repoId),
  ]
);

// Flat (unthreaded) public comments. Soft-deleted rather than removed outright
// so moderation stays auditable and counts stay stable; only 'visible' rows are
// ever rendered or counted.
export const repoComments = pgTable(
  "repo_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    status: text("status", { enum: ["visible", "removed"] })
      .notNull()
      .default("visible"),
    removedByUserId: uuid("removed_by_user_id").references(() => users.id),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("repo_comments_repo_created_idx").on(t.repoId, t.createdAt),
    index("repo_comments_status_created_idx").on(t.status, t.createdAt),
  ]
);

// User-curated, link-shareable repo lists ("collections"). The slug carries a
// random suffix so a list is only reachable by the link its owner shares.
// Contributions are open by default: anyone signed in who has the link can add
// repos, and the owner can remove any item or lock the list at any time.
export const repoLists = pgTable(
  "repo_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description"),
    // "open" = any signed-in visitor may add repos; "closed" = owner only.
    contributions: text("contributions", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    // Moderation: a 'removed' list 404s for everyone except staff.
    status: text("status", { enum: ["active", "removed"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("repo_lists_owner_idx").on(t.ownerUserId, t.createdAt)]
);

// Items may only point at repos already listed on repoherald — curating an
// arbitrary GitHub URL would create a listing whose ownership nobody verified,
// which is exactly what postRepo's owner/org check exists to prevent.
export const repoListItems = pgTable(
  "repo_list_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .notNull()
      .references(() => repoLists.id, { onDelete: "cascade" }),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repos.id, { onDelete: "cascade" }),
    addedByUserId: uuid("added_by_user_id")
      .notNull()
      .references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A repo appears at most once per list, so concurrent adds can't duplicate.
    uniqueIndex("repo_list_items_pair_uq").on(t.listId, t.repoId),
    index("repo_list_items_list_idx").on(t.listId, t.createdAt),
  ]
);

// One row per checkout attempt. credits/amount are snapshotted at purchase
// time so later pack edits never change what a buyer paid for. The ledger
// grant itself lives in credit_entries (type 'purchase'), keyed back here.
export const creditPurchases = pgTable(
  "credit_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    packId: uuid("pack_id")
      .notNull()
      .references(() => creditPacks.id),
    credits: integer("credits").notNull(),
    status: text("status", {
      enum: ["pending_payment", "completed", "cancelled", "refunded"],
    })
      .notNull()
      .default("pending_payment"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    amountCents: integer("amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("credit_purchases_user_idx").on(t.userId, t.createdAt),
    index("credit_purchases_intent_idx").on(t.stripePaymentIntentId),
  ]
);
