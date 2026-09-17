import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)$/m)[1].replace(/^["']|["']$/g,'').trim();
const sql = neon(url);
const tables = ['users','repos','star_mints','credit_entries','highlights','sponsorships',
  'repo_likes','repo_comments','repo_lists','repo_list_items','credit_purchases',
  'issue_reports','social_shares','support_tickets','analytics_events'];
for (const t of tables) {
  try {
    const [r] = await sql(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(String(r.n).padStart(6), t);
  } catch (e) { console.log('   ERR', t, e.message.slice(0,60)); }
}
