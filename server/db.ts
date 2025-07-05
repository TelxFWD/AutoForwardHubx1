import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Export database instance if DATABASE_URL is available
export let db: ReturnType<typeof drizzle> | null = null;
export let pool: Pool | null = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle({ client: pool, schema });
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    db = null;
    pool = null;
  }
} else {
  console.log('ℹ️  DATABASE_URL not set. Database features will be unavailable until configured.');
}