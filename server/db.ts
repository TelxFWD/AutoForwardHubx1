import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";
import { mkdir } from 'fs/promises';
import path from 'path';

neonConfig.webSocketConstructor = ws;

// Database connection - PostgreSQL if available, SQLite as fallback
let pool: Pool | null = null;
let db: any = null;

async function initializeDatabase() {
  if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'))) {
    // PostgreSQL connection
    try {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle({ client: pool, schema });
      console.log("✅ PostgreSQL database connected successfully");
      return;
    } catch (error) {
      console.warn("PostgreSQL connection failed:", error);
      console.log("Falling back to SQLite database");
    }
  }
  
  // SQLite fallback
  try {
    const dbDir = path.join(process.cwd(), 'data');
    await mkdir(dbDir, { recursive: true });
    
    const sqlite = new Database(path.join(dbDir, 'database.sqlite'));
    db = drizzleSqlite(sqlite, { schema });
    console.log("✅ SQLite database connected successfully");
  } catch (error) {
    console.error("SQLite connection failed:", error);
    console.log("Database will be unavailable");
  }
}

// Initialize database connection
initializeDatabase().catch(console.error);

export { pool, db };