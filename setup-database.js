import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database
const db = new Database(path.join(dataDir, 'database.sqlite'));

// Create tables based on schema
const createTables = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  session_file TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Pairs table
CREATE TABLE IF NOT EXISTS pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pair_type TEXT NOT NULL DEFAULT 'telegram',
  source_channel TEXT NOT NULL,
  discord_webhook TEXT,
  discord_channel_id TEXT,
  auto_webhook BOOLEAN DEFAULT false,
  destination_channel TEXT,
  bot_token TEXT,
  session_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  enable_ai BOOLEAN DEFAULT false,
  remove_mentions BOOLEAN DEFAULT false,
  header_patterns TEXT,
  footer_patterns TEXT,
  message_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  telegram_bot_id INTEGER,
  discord_bot_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (telegram_bot_id) REFERENCES telegram_bots(id),
  FOREIGN KEY (discord_bot_id) REFERENCES discord_bots(id)
);

-- Telegram bots table
CREATE TABLE IF NOT EXISTS telegram_bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  is_default BOOLEAN DEFAULT false,
  last_validated DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Discord bots table
CREATE TABLE IF NOT EXISTS discord_bots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  guilds INTEGER DEFAULT 0,
  last_ping DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Blocklists table
CREATE TABLE IF NOT EXISTS blocklists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pair_id INTEGER,
  type TEXT NOT NULL,
  pattern TEXT NOT NULL,
  description TEXT,
  is_global BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (pair_id) REFERENCES pairs(id)
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  component TEXT NOT NULL DEFAULT 'system',
  pair_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (pair_id) REFERENCES pairs(id)
);

-- System stats table
CREATE TABLE IF NOT EXISTS system_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_pairs INTEGER DEFAULT 0,
  active_pairs INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  blocked_messages INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Message mappings table
CREATE TABLE IF NOT EXISTS message_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pair_id INTEGER NOT NULL,
  discord_message_id TEXT NOT NULL,
  telegram_message_id TEXT NOT NULL,
  edit_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (pair_id) REFERENCES pairs(id)
);

-- OTP verification table
CREATE TABLE IF NOT EXISTS otp_verification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone_number TEXT NOT NULL,
  phone_code_hash TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

// Execute the SQL to create tables
db.exec(createTables);

// Create default admin user
const adminPin = bcrypt.hashSync('1234', 10);

const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO users (username, pin, role) 
  VALUES (?, ?, ?)
`);

insertAdmin.run('admin', adminPin, 'admin');

console.log('✅ SQLite database created successfully');
console.log('✅ Tables created');
console.log('✅ Default admin user created (PIN: 1234)');
console.log('Database location:', path.join(dataDir, 'database.sqlite'));

db.close();