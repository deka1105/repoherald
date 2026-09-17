import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g,'').trim();
const sql = neon(url);
const rows = await sql`
  SELECT 'users' t, count(*)::int n FROM users
  UNION ALL SELECT 'repos', count(*)::int FROM repos
  UNION ALL SELECT 'star_mints', count(*)::int FROM star_mints
  UNION ALL SELECT 'credit_entries', count(*)::int FROM credit_entries
  UNION ALL SELECT 'highlights', count(*)::int FROM highlights
  UNION ALL SELECT 'sponsorships', count(*)::int FROM sponsorships
  UNION ALL SELECT 'repo_likes', count(*)::int FROM repo_likes
  UNION ALL SELECT 'repo_comments', count(*)::int FROM repo_comments
  UNION ALL SELECT 'repo_lists', count(*)::int FROM repo_lists
  UNION ALL SELECT 'credit_purchases', count(*)::int FROM credit_purchases
  UNION ALL SELECT 'issue_reports', count(*)::int FROM issue_reports
  UNION ALL SELECT 'social_shares', count(*)::int FROM social_shares
  UNION ALL SELECT 'support_tickets', count(*)::int FROM support_tickets
  UNION ALL SELECT 'analytics_events', count(*)::int FROM analytics_events`;
for (const r of rows) console.log(String(r.n).padStart(6), r.t);
const [last] = await sql`SELECT max(created_at) AS m FROM analytics_events`;
console.log('\nlast analytics event:', last.m);
const [lu] = await sql`SELECT max(created_at) AS m FROM users`;
console.log('newest user:', lu.m);
