import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";
import { mkdir } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables before database initialization
dotenv.config();

neonConfig.webSocketConstructor = ws;

// Database connection - PostgreSQL if available, SQLite as fallback
let pool: Pool | null = null;
let db: any = null;

// Synchronous SQLite initialization for immediate availability
function initializeSQLite() {
  try {
    const dbDir = path.join(process.cwd(), 'data');
    
    // Create directory synchronously
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    const sqlite = new Database(path.join(dbDir, 'database.sqlite'));
    db = drizzleSqlite(sqlite, { schema });
    console.log("✅ SQLite database connected successfully");
    return true;
  } catch (error) {
    console.error("SQLite connection failed:", error);
    return false;
  }
}

// Try PostgreSQL first, then SQLite
if (process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgresql://') || process.env.DATABASE_URL.startsWith('postgres://'))) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log("✅ PostgreSQL database connected successfully");
  } catch (error) {
    console.warn("PostgreSQL connection failed:", error);
    console.log("Falling back to SQLite database");
    initializeSQLite();
  }
} else if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('sqlite:')) {
  // SQLite connection
  initializeSQLite();
} else {
  console.log("No DATABASE_URL configured. Database will be unavailable.");
}

export { pool, db };