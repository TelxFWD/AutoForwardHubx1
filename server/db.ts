import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Optional database connection - fallback to in-memory if not available
let pool: Pool | null = null;
let db: any = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log("Database connected successfully");
  } catch (error) {
    console.warn("Database connection failed:", error);
    console.log("Falling back to in-memory storage");
  }
} else {
  console.log("DATABASE_URL not set. Using in-memory storage");
}

export { pool, db };