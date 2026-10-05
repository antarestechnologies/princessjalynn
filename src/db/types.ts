import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any drizzle Postgres instance with our schema: node-postgres in the app, PGlite in tests. */
export type AppDb = PgDatabase<PgQueryResultHKT, typeof schema>;
