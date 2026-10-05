import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit reads DATABASE_URL only for `db:studio` and `db:push`.
// `db:generate` (the command we use) works purely from the schema file.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/princessjalynn",
  },
});
