import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const marker = process.argv[2];
const del = await sql`DELETE FROM analytics_events WHERE path = ${marker} RETURNING id`;
const total = await sql`SELECT count(*)::int AS n FROM analytics_events`;
console.log("deleted test rows:", del.length, "| remaining rows:", total[0].n);
