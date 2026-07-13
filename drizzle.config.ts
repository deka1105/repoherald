import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env for the CLI (migrate/generate) so DATABASE_URL is available
// without sourcing .env.local by hand. .env.local wins over .env if present.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
