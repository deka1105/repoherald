import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// WebSocket driver (not neon-http) because the credit ledger needs
// interactive transactions with SELECT ... FOR UPDATE.
neonConfig.webSocketConstructor = ws;

// Bounded per function instance: Fluid Compute reuses instances across
// concurrent requests, so an uncapped pool multiplied across instances can
// exhaust Neon's connection ceiling under load. Idle connections are released
// quickly so scaled-down instances don't pin them.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
