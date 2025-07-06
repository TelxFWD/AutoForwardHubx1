import { db } from "./db";
import * as schema from "@shared/schema";

// Initialize SQLite database with proper table creation
export async function initializeDatabase() {
  if (!db) {
    console.warn("Database not available for initialization");
    return false;
  }

  try {
    console.log("🚀 Initializing SQLite database...");
    
    // Create all tables using SQL since Drizzle push doesn't work with SQLite for this setup
    const sqlStatements = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pin TEXT NOT NULL UNIQUE,
        pin_hash TEXT NOT NULL,
        display_name TEXT,
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // User sessions table
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Pairs table
      `CREATE TABLE IF NOT EXISTS pairs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        pair_type TEXT NOT NULL DEFAULT 'telegram',
        source_channel TEXT NOT NULL,
        discord_webhook TEXT,
        discord_channel_id TEXT,
        auto_webhook INTEGER DEFAULT 0,
        destination_channel TEXT NOT NULL,
        bot_token TEXT,
        telegram_bot_id INTEGER,
        discord_bot_id INTEGER,
        session_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        enable_ai INTEGER DEFAULT 0,
        remove_mentions INTEGER DEFAULT 1,
        header_patterns TEXT,
        footer_patterns TEXT,
        message_count INTEGER DEFAULT 0,
        blocked_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Discord bots table
      `CREATE TABLE IF NOT EXISTS discord_bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        guilds INTEGER DEFAULT 0,
        last_ping TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Telegram bots table
      `CREATE TABLE IF NOT EXISTS telegram_bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        token TEXT NOT NULL,
        username TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        is_default INTEGER DEFAULT 0,
        last_validated TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        session_file TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        last_active TEXT DEFAULT (datetime('now')),
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Blocklists table
      `CREATE TABLE IF NOT EXISTS blocklists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        pair_id INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Message mappings table
      `CREATE TABLE IF NOT EXISTS message_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_message_id TEXT NOT NULL,
        discord_message_id TEXT,
        destination_telegram_message_id TEXT,
        pair_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'forwarded',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // Activities table
      `CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        pair_id INTEGER,
        session_id INTEGER,
        severity TEXT NOT NULL DEFAULT 'info',
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      
      // System stats table
      `CREATE TABLE IF NOT EXISTS system_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        active_pairs INTEGER DEFAULT 0 NOT NULL,
        total_messages INTEGER DEFAULT 0 NOT NULL,
        blocked_messages INTEGER DEFAULT 0 NOT NULL,
        active_sessions INTEGER DEFAULT 0 NOT NULL,
        last_updated TEXT DEFAULT (datetime('now')) NOT NULL
      )`,
      
      // OTP verification table
      `CREATE TABLE IF NOT EXISTS otp_verification (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL UNIQUE,
        phone_code_hash TEXT NOT NULL,
        session_name TEXT NOT NULL,
        user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    ];

    // Execute each SQL statement
    for (const sql of sqlStatements) {
      await (db as any).run(sql);
    }

    console.log("✅ Database tables initialized successfully");
    return true;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    return false;
  }
}

// Auto-initialize when this module is imported
initializeDatabase();