import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const marker = process.argv[2];
const total = await sql`SELECT count(*)::int AS n FROM analytics_events`;
const row = await sql`SELECT type, path, referrer_host, is_admin, user_id, visitor_id
                      FROM analytics_events WHERE path = ${marker} ORDER BY created_at DESC LIMIT 1`;
console.log("total analytics_events rows:", total[0].n);
console.log("marker row:", JSON.stringify(row[0] ?? "NOT FOUND"));
const idx = await sql`SELECT indexname FROM pg_indexes WHERE indexname IN ('credit_entries_welcome_uq','analytics_events_type_created_idx','analytics_events_repo_type_idx') ORDER BY 1`;
console.log("indexes present:", idx.map(r => r.indexname));
