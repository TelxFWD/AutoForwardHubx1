import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  pin: text("pin").notNull().unique(), // 4-digit PIN (hashed)
  pinHash: text("pin_hash").notNull(), // bcrypt hash of PIN
  displayName: text("display_name"), // Optional display name
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pairs = pgTable("pairs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  sourceChannel: text("source_channel").notNull(),
  discordWebhook: text("discord_webhook").notNull(),
  destinationChannel: text("destination_channel").notNull(),
  botToken: text("bot_token").notNull(),
  session: text("session").notNull(),
  status: text("status").notNull().default("active"), // active, paused, error
  enableAI: boolean("enable_ai").default(false),
  messageCount: integer("message_count").default(0),
  blockedCount: integer("blocked_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  sessionFile: text("session_file").notNull(),
  status: text("status").notNull().default("active"), // active, inactive, error
  lastActive: timestamp("last_active").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blocklists = pgTable("blocklists", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // word, image_hash, trap_pattern
  value: text("value").notNull(),
  pairId: integer("pair_id"), // null for global blocklist
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageMappings = pgTable("message_mappings", {
  id: serial("id").primaryKey(),
  telegramMessageId: text("telegram_message_id").notNull(),
  discordMessageId: text("discord_message_id"),
  destinationTelegramMessageId: text("destination_telegram_message_id"),
  pairId: integer("pair_id").notNull(),
  status: text("status").notNull().default("forwarded"), // forwarded, blocked, error
  createdAt: timestamp("created_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // message_forwarded, trap_detected, session_connected, pair_paused, etc.
  message: text("message").notNull(),
  details: text("details"),
  pairId: integer("pair_id"),
  sessionId: integer("session_id"),
  severity: text("severity").notNull().default("info"), // info, warning, error, success
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemStats = pgTable("system_stats", {
  id: serial("id").primaryKey(),
  activePairs: integer("active_pairs").default(0).notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  blockedMessages: integer("blocked_messages").default(0).notNull(),
  activeSessions: integer("active_sessions").default(0).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLogin: true,
  createdAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertPairSchema = createInsertSchema(pairs).omit({
  id: true,
  messageCount: true,
  blockedCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  lastActive: true,
  createdAt: true,
});

export const insertBlocklistSchema = createInsertSchema(blocklists).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

// Additional schemas for PIN validation
export const pinLoginSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const createUserSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  displayName: z.string().optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type Pair = typeof pairs.$inferSelect;
export type InsertPair = z.infer<typeof insertPairSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Blocklist = typeof blocklists.$inferSelect;
export type InsertBlocklist = z.infer<typeof insertBlocklistSchema>;

export type MessageMapping = typeof messageMappings.$inferSelect;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type SystemStats = typeof systemStats.$inferSelect;

export type PinLogin = z.infer<typeof pinLoginSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
