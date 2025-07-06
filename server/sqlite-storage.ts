import { 
  users, pairs, sessions, blocklists, messageMappings, activities, systemStats, otpVerification, discordBots, telegramBots,
  type User, type InsertUser, type Pair, type InsertPair,
  type Session, type InsertSession, type Blocklist, type InsertBlocklist,
  type Activity, type InsertActivity, type SystemStats, type OtpVerification, type InsertOtpVerification,
  type DiscordBot, type InsertDiscordBot, type TelegramBot, type InsertTelegramBot
} from "@shared/schema";
import { db } from "./db";
import { eq, isNull, desc, lt } from "drizzle-orm";
import type { IStorage } from "./storage";

// SQLite-specific storage implementation that handles dates as strings
export class SqliteStorage implements IStorage {
  private toISOString(date?: Date | string | null): string | null {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
  }

  async getUser(id: number): Promise<User | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByPin(pin: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not available");
    const [user] = await db.select().from(users).where(eq(users.pin, pin));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not available");
    const [newUser] = await db.insert(users).values({
      ...user,
      createdAt: new Date().toISOString(),
    }).returning();
    return newUser;
  }

  async getAllPairs(userId?: number): Promise<Pair[]> {
    if (!db) throw new Error("Database not available");
    if (userId) {
      return await db.select().from(pairs).where(eq(pairs.userId, userId));
    }
    return await db.select().from(pairs);
  }

  async getPair(id: number): Promise<Pair | undefined> {
    if (!db) throw new Error("Database not available");
    const [pair] = await db.select().from(pairs).where(eq(pairs.id, id));
    return pair || undefined;
  }

  async createPair(pair: InsertPair): Promise<Pair> {
    if (!db) throw new Error("Database not available");
    const now = new Date().toISOString();
    const [newPair] = await db.insert(pairs).values({
      ...pair,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return newPair;
  }

  async updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db
      .update(pairs)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(pairs.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePair(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(pairs).where(eq(pairs.id, id));
    return (result.changes || 0) > 0;
  }

  async getAllSessions(userId?: number): Promise<Session[]> {
    if (!db) throw new Error("Database not available");
    if (userId) {
      return await db.select().from(sessions).where(eq(sessions.userId, userId));
    }
    return await db.select().from(sessions);
  }

  async getSession(id: number): Promise<Session | undefined> {
    if (!db) throw new Error("Database not available");
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    if (!db) throw new Error("Database not available");
    const [session] = await db.select().from(sessions).where(eq(sessions.name, name));
    return session || undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    if (!db) throw new Error("Database not available");
    const [newSession] = await db.insert(sessions).values({
      ...session,
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }).returning();
    return newSession;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db
      .update(sessions)
      .set({ ...updates, lastActive: new Date().toISOString() })
      .where(eq(sessions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteSession(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return (result.changes || 0) > 0;
  }

  async getAllBlocklists(): Promise<Blocklist[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(blocklists);
  }

  async getBlocklistsByType(type: string): Promise<Blocklist[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(blocklists).where(eq(blocklists.type, type));
  }

  async getGlobalBlocklists(): Promise<Blocklist[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(blocklists).where(isNull(blocklists.pairId));
  }

  async getPairBlocklists(pairId: number): Promise<Blocklist[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(blocklists).where(eq(blocklists.pairId, pairId));
  }

  async createBlocklist(blocklist: InsertBlocklist): Promise<Blocklist> {
    if (!db) throw new Error("Database not available");
    const [newBlocklist] = await db.insert(blocklists).values({
      ...blocklist,
      createdAt: new Date().toISOString(),
    }).returning();
    return newBlocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(blocklists).where(eq(blocklists.id, id));
    return (result.changes || 0) > 0;
  }

  async getRecentActivities(limit: number = 50): Promise<Activity[]> {
    if (!db) throw new Error("Database not available");
    return await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    if (!db) throw new Error("Database not available");
    const [newActivity] = await db.insert(activities).values({
      ...activity,
      createdAt: new Date().toISOString(),
    }).returning();
    return newActivity;
  }

  async getSystemStats(): Promise<SystemStats | undefined> {
    if (!db) throw new Error("Database not available");
    const [stats] = await db.select().from(systemStats).limit(1);
    return stats || undefined;
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats> {
    if (!db) throw new Error("Database not available");
    const existing = await this.getSystemStats();
    
    if (!existing) {
      const [newStats] = await db.insert(systemStats).values({
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0,
        lastUpdated: new Date().toISOString(),
        ...stats,
      }).returning();
      return newStats;
    } else {
      const [updated] = await db
        .update(systemStats)
        .set({ ...stats, lastUpdated: new Date().toISOString() })
        .where(eq(systemStats.id, existing.id))
        .returning();
      return updated;
    }
  }

  async getOtpVerification(phoneNumber: string): Promise<OtpVerification | undefined> {
    if (!db) throw new Error("Database not available");
    const [otp] = await db.select().from(otpVerification).where(eq(otpVerification.phoneNumber, phoneNumber));
    return otp || undefined;
  }

  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    if (!db) throw new Error("Database not available");
    const [newOtp] = await db.insert(otpVerification).values({
      ...otp,
      createdAt: new Date().toISOString(),
    }).returning();
    return newOtp;
  }

  async updateOtpVerification(phoneNumber: string, updates: Partial<OtpVerification>): Promise<OtpVerification | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db
      .update(otpVerification)
      .set(updates)
      .where(eq(otpVerification.phoneNumber, phoneNumber))
      .returning();
    return updated || undefined;
  }

  async deleteOtpVerification(phoneNumber: string): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db
      .delete(otpVerification)
      .where(eq(otpVerification.phoneNumber, phoneNumber));
    return (result.changes || 0) > 0;
  }

  async cleanExpiredOtpVerifications(): Promise<void> {
    if (!db) throw new Error("Database not available");
    const now = new Date().toISOString();
    await db
      .delete(otpVerification)
      .where(lt(otpVerification.expiresAt, now));
  }

  async getAllDiscordBots(userId?: number): Promise<DiscordBot[]> {
    if (!db) throw new Error("Database not available");
    if (userId) {
      return await db.select().from(discordBots).where(eq(discordBots.userId, userId));
    }
    return await db.select().from(discordBots);
  }

  async getDiscordBot(id: number): Promise<DiscordBot | undefined> {
    if (!db) throw new Error("Database not available");
    const [bot] = await db.select().from(discordBots).where(eq(discordBots.id, id));
    return bot || undefined;
  }

  async createDiscordBot(bot: InsertDiscordBot): Promise<DiscordBot> {
    if (!db) throw new Error("Database not available");
    const now = new Date().toISOString();
    const [created] = await db.insert(discordBots).values({
      ...bot,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return created;
  }

  async updateDiscordBot(id: number, updates: Partial<DiscordBot>): Promise<DiscordBot | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db
      .update(discordBots)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(discordBots.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDiscordBot(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(discordBots).where(eq(discordBots.id, id));
    return (result.changes || 0) > 0;
  }

  async getAllTelegramBots(userId?: number): Promise<TelegramBot[]> {
    if (!db) throw new Error("Database not available");
    const query = userId 
      ? db.select().from(telegramBots).where(eq(telegramBots.userId, userId))
      : db.select().from(telegramBots);
    
    return await query;
  }

  async getTelegramBot(id: number): Promise<TelegramBot | undefined> {
    if (!db) throw new Error("Database not available");
    const [bot] = await db.select().from(telegramBots).where(eq(telegramBots.id, id));
    return bot || undefined;
  }

  async createTelegramBot(bot: InsertTelegramBot): Promise<TelegramBot> {
    if (!db) throw new Error("Database not available");
    const now = new Date().toISOString();
    const [newBot] = await db.insert(telegramBots).values({
      ...bot,
      createdAt: now,
      updatedAt: now,
    }).returning();
    return newBot;
  }

  async updateTelegramBot(id: number, updates: Partial<TelegramBot>): Promise<TelegramBot | undefined> {
    if (!db) throw new Error("Database not available");
    const [updated] = await db
      .update(telegramBots)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(telegramBots.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTelegramBot(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(telegramBots).where(eq(telegramBots.id, id));
    return (result.changes || 0) > 0;
  }

  async setDefaultTelegramBot(userId: number, botId: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    
    // First, unset all defaults for this user
    await db
      .update(telegramBots)
      .set({ isDefault: false, updatedAt: new Date().toISOString() })
      .where(eq(telegramBots.userId, userId));

    // Then set the new default
    const result = await db
      .update(telegramBots)
      .set({ isDefault: true, updatedAt: new Date().toISOString() })
      .where(eq(telegramBots.id, botId));

    return (result.changes || 0) > 0;
  }
}