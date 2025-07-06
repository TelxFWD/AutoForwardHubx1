import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pin: text("pin").notNull().unique(), // 4-digit PIN (hashed)
  pinHash: text("pin_hash").notNull(), // bcrypt hash of PIN
  displayName: text("display_name"), // Optional display name
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastLogin: text("last_login"), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const userSessions = sqliteTable("user_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: text("expires_at").notNull(), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const pairs = sqliteTable("pairs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  pairType: text("pair_type").notNull().default("tel-tel"), // tel-tel, tel-disc-tel
  sourceChannel: text("source_channel").notNull(),
  discordWebhook: text("discord_webhook"), // Optional for tel-tel pairs
  discordChannelId: text("discord_channel_id"), // Discord channel ID for auto-webhook
  autoWebhook: integer("auto_webhook", { mode: "boolean" }).default(false), // Auto-create webhook toggle
  destinationChannel: text("destination_channel").notNull(),
  botToken: text("bot_token"), // Optional for tel-tel pairs
  telegramBotId: integer("telegram_bot_id"),
  discordBotId: integer("discord_bot_id"),
  session: text("session_name").notNull(),
  status: text("status").notNull().default("active"), // active, paused, error
  
  // Advanced features (shared between both pair types)
  enableAI: integer("enable_ai", { mode: "boolean" }).default(false),
  enableTrapDetection: integer("enable_trap_detection", { mode: "boolean" }).default(true),
  applyStripRules: integer("apply_strip_rules", { mode: "boolean" }).default(true),
  useMentionFilter: integer("use_mention_filter", { mode: "boolean" }).default(true),
  
  // Content filtering patterns
  removeMentions: integer("remove_mentions", { mode: "boolean" }).default(true),
  blockImages: integer("block_images", { mode: "boolean" }).default(false),
  stripFooter: integer("strip_footer", { mode: "boolean" }).default(false),
  footerPatterns: text("footer_patterns"), // JSON array of footer regex patterns
  
  // Statistics
  messageCount: integer("message_count").default(0),
  blockedCount: integer("blocked_count").default(0),
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
  updatedAt: text("updated_at").default("datetime('now')"), // ISO string format
});

export const discordBots = sqliteTable("discord_bots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  token: text("token").notNull(),
  status: text("status").notNull().default("active"), // active, inactive, error
  guilds: integer("guilds").default(0),
  lastPing: text("last_ping"), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
  updatedAt: text("updated_at").default("datetime('now')"), // ISO string format
});

export const telegramBots = sqliteTable("telegram_bots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  token: text("token").notNull(),
  username: text("username"),
  status: text("status").notNull().default("active"), // active, inactive, error
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  lastValidated: text("last_validated"), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
  updatedAt: text("updated_at").default("datetime('now')"), // ISO string format
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(), // Associated user
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  sessionFile: text("session_file").notNull(),
  status: text("status").notNull().default("active"), // active, inactive, error
  lastActive: text("last_active").default("datetime('now')"), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const blocklists = sqliteTable("blocklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // word, image_hash, trap_pattern, header_regex, footer_regex, block_images
  value: text("value").notNull(),
  pairId: integer("pair_id"), // null for global blocklist
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const messageMappings = sqliteTable("message_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramMessageId: text("telegram_message_id").notNull(),
  discordMessageId: text("discord_message_id"),
  destinationTelegramMessageId: text("destination_telegram_message_id"),
  pairId: integer("pair_id").notNull(),
  status: text("status").notNull().default("forwarded"), // forwarded, blocked, error
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // message_forwarded, trap_detected, session_connected, pair_paused, etc.
  message: text("message").notNull(),
  details: text("details"),
  pairId: integer("pair_id"),
  sessionId: integer("session_id"),
  severity: text("severity").notNull().default("info"), // info, warning, error, success
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
});

export const systemStats = sqliteTable("system_stats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  activePairs: integer("active_pairs").default(0).notNull(),
  totalMessages: integer("total_messages").default(0).notNull(),
  blockedMessages: integer("blocked_messages").default(0).notNull(),
  activeSessions: integer("active_sessions").default(0).notNull(),
  lastUpdated: text("last_updated").default("datetime('now')").notNull(), // ISO string format
});

export const otpVerification = sqliteTable("otp_verification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phoneNumber: text("phone_number").notNull().unique(),
  phoneCodeHash: text("phone_code_hash").notNull(),
  sessionName: text("session_name").notNull(),
  userId: integer("user_id"),
  status: text("status").notNull().default("pending"), // pending, verified, expired
  expiresAt: text("expires_at").notNull(), // ISO string format
  createdAt: text("created_at").default("datetime('now')"), // ISO string format
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

// Separate schemas for different pair types
export const insertTelTelPairSchema = createInsertSchema(pairs).omit({
  id: true,
  messageCount: true,
  blockedCount: true,
  createdAt: true,
  updatedAt: true,
  discordWebhook: true,
  discordChannelId: true,
  autoWebhook: true,
  discordBotId: true,
}).extend({
  pairType: z.literal("tel-tel"),
  // Advanced features for tel-tel pairs
  enableTrapDetection: z.boolean().default(true),
  applyStripRules: z.boolean().default(true),
  useMentionFilter: z.boolean().default(true),
  enableAI: z.boolean().default(false),
  removeMentions: z.boolean().default(true),
  blockImages: z.boolean().default(false),
  stripFooter: z.boolean().default(false),
  footerPatterns: z.string().optional()
});

export const insertTelDiscTelPairSchema = createInsertSchema(pairs).omit({
  id: true,
  messageCount: true,
  blockedCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  pairType: z.literal("tel-disc-tel"),
  discordWebhook: z.string().url("Discord webhook must be a valid URL").optional(),
  discordChannelId: z.string().optional(),
  autoWebhook: z.boolean().default(false),
  // Advanced features for tel-disc-tel pairs
  enableTrapDetection: z.boolean().default(true),
  applyStripRules: z.boolean().default(true),
  useMentionFilter: z.boolean().default(true),
  enableAI: z.boolean().default(false),
  removeMentions: z.boolean().default(true),
  blockImages: z.boolean().default(false),
  stripFooter: z.boolean().default(false),
  footerPatterns: z.string().optional()
});

export const insertDiscordBotSchema = createInsertSchema(discordBots).omit({
  id: true,
  guilds: true,
  lastPing: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTelegramBotSchema = createInsertSchema(telegramBots).omit({
  id: true,
  username: true,
  lastValidated: true,
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

export const insertOtpVerificationSchema = createInsertSchema(otpVerification).omit({
  id: true,
  createdAt: true,
});

// Additional schemas for PIN validation
export const pinLoginSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 characters").max(4, "PIN must be at most 4 characters").regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const createUserSchema = z.object({
  pin: z.string().min(4, "PIN must be at least 4 characters").max(4, "PIN must be at most 4 characters").regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  displayName: z.string().min(1, "Display name is required").optional(),
});

// OTP schemas
export const otpRequestSchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number must be at most 15 digits"),
  sessionName: z.string().min(1, "Session name is required").optional(),
});

export const otpVerifySchema = z.object({
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number must be at most 15 digits"),
  code: z.string().min(5, "OTP code must be at least 5 digits").max(6, "OTP code must be at most 6 digits"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

export type Pair = typeof pairs.$inferSelect;
export type InsertPair = z.infer<typeof insertPairSchema>;
export type InsertTelTelPair = z.infer<typeof insertTelTelPairSchema>;
export type InsertTelDiscTelPair = z.infer<typeof insertTelDiscTelPairSchema>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

export type Blocklist = typeof blocklists.$inferSelect;
export type InsertBlocklist = z.infer<typeof insertBlocklistSchema>;

export type MessageMapping = typeof messageMappings.$inferSelect;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type SystemStats = typeof systemStats.$inferSelect;

export type OtpVerification = typeof otpVerification.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;

export type DiscordBot = typeof discordBots.$inferSelect;
export type InsertDiscordBot = z.infer<typeof insertDiscordBotSchema>;

export type TelegramBot = typeof telegramBots.$inferSelect;
export type InsertTelegramBot = z.infer<typeof insertTelegramBotSchema>;

export type PinLogin = z.infer<typeof pinLoginSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpVerify = z.infer<typeof otpVerifySchema>;