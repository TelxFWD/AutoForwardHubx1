import { 
  users, pairs, sessions, blocklists, messageMappings, activities, systemStats,
  type User, type InsertUser, type Pair, type InsertPair, 
  type Session, type InsertSession, type Blocklist, type InsertBlocklist,
  type Activity, type InsertActivity, type SystemStats
} from "@shared/schema";
import { db } from "./db";
import { eq, isNull, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pairs
  getAllPairs(): Promise<Pair[]>;
  getPair(id: number): Promise<Pair | undefined>;
  createPair(pair: InsertPair): Promise<Pair>;
  updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined>;
  deletePair(id: number): Promise<boolean>;

  // Sessions
  getAllSessions(): Promise<Session[]>;
  getSession(id: number): Promise<Session | undefined>;
  getSessionByName(name: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined>;
  deleteSession(id: number): Promise<boolean>;

  // Blocklists
  getAllBlocklists(): Promise<Blocklist[]>;
  getBlocklistsByType(type: string): Promise<Blocklist[]>;
  getGlobalBlocklists(): Promise<Blocklist[]>;
  getPairBlocklists(pairId: number): Promise<Blocklist[]>;
  createBlocklist(blocklist: InsertBlocklist): Promise<Blocklist>;
  deleteBlocklist(id: number): Promise<boolean>;

  // Activities
  getRecentActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;

  // System Stats
  getSystemStats(): Promise<SystemStats | undefined>;
  updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats>;
}

// In-memory storage implementation for development
export class MemStorage implements IStorage {
  private users = new Map<number, User>();
  private pairs = new Map<number, Pair>();
  private sessions = new Map<number, Session>();
  private blocklists = new Map<number, Blocklist>();
  private activities = new Map<number, Activity>();
  private systemStats: SystemStats | null = null;
  private nextId = 1;

  constructor() {
    // Seed with initial data
    this.seedData();
  }

  private seedData() {
    // Create initial system stats
    this.systemStats = {
      id: 1,
      activePairs: 0,
      totalMessages: 0,
      blockedMessages: 0,
      activeSessions: 0,
      lastUpdated: new Date()
    };

    // Create sample data
    const samplePair: Pair = {
      id: 1,
      name: "Sample Channel Pair",
      sourceChannel: "-1001234567890",
      discordWebhook: "https://discord.com/api/webhooks/sample",
      destinationChannel: "@destination_channel",
      botToken: "sample_bot_token",
      session: "main_session",
      status: "active",
      enableAI: false,
      messageCount: 42,
      blockedCount: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.pairs.set(1, samplePair);

    const sampleSession: Session = {
      id: 1,
      name: "Main Session",
      phone: "+1234567890",
      sessionFile: "main_session.session",
      status: "active",
      lastActive: new Date(),
      createdAt: new Date()
    };
    this.sessions.set(1, sampleSession);

    this.nextId = 2;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: this.nextId++,
      username: insertUser.username,
      password: insertUser.password
    };
    this.users.set(user.id, user);
    return user;
  }

  // Pairs
  async getAllPairs(): Promise<Pair[]> {
    return Array.from(this.pairs.values());
  }

  async getPair(id: number): Promise<Pair | undefined> {
    return this.pairs.get(id);
  }

  async createPair(insertPair: InsertPair): Promise<Pair> {
    const pair: Pair = {
      id: this.nextId++,
      name: insertPair.name,
      sourceChannel: insertPair.sourceChannel,
      discordWebhook: insertPair.discordWebhook,
      destinationChannel: insertPair.destinationChannel,
      botToken: insertPair.botToken,
      session: insertPair.session,
      status: insertPair.status || "active",
      enableAI: insertPair.enableAI || false,
      messageCount: 0,
      blockedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.pairs.set(pair.id, pair);
    await this.createActivity({
      type: "pair_created",
      message: `Created new pair: ${pair.name}`,
      pairId: pair.id,
      severity: "success"
    });
    return pair;
  }

  async updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined> {
    const pair = this.pairs.get(id);
    if (!pair) return undefined;
    
    const updatedPair = { ...pair, ...updates, updatedAt: new Date() };
    this.pairs.set(id, updatedPair);
    return updatedPair;
  }

  async deletePair(id: number): Promise<boolean> {
    return this.pairs.delete(id);
  }

  // Sessions
  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.name === name);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const session: Session = {
      id: this.nextId++,
      name: insertSession.name,
      phone: insertSession.phone,
      sessionFile: insertSession.sessionFile,
      status: insertSession.status || "active",
      lastActive: new Date(),
      createdAt: new Date()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }

  // Blocklists
  async getAllBlocklists(): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values());
  }

  async getBlocklistsByType(type: string): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(b => b.type === type);
  }

  async getGlobalBlocklists(): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(b => b.pairId === null);
  }

  async getPairBlocklists(pairId: number): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(b => b.pairId === pairId);
  }

  async createBlocklist(insertBlocklist: InsertBlocklist): Promise<Blocklist> {
    const blocklist: Blocklist = {
      id: this.nextId++,
      type: insertBlocklist.type,
      value: insertBlocklist.value,
      pairId: insertBlocklist.pairId || null,
      isActive: insertBlocklist.isActive !== false,
      createdAt: new Date()
    };
    this.blocklists.set(blocklist.id, blocklist);
    return blocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    return this.blocklists.delete(id);
  }

  // Activities
  async getRecentActivities(limit: number = 50): Promise<Activity[]> {
    const activities = Array.from(this.activities.values())
      .sort((a, b) => {
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
    return activities;
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const activity: Activity = {
      id: this.nextId++,
      type: insertActivity.type,
      message: insertActivity.message,
      details: insertActivity.details || null,
      pairId: insertActivity.pairId || null,
      sessionId: insertActivity.sessionId || null,
      severity: insertActivity.severity || "info",
      createdAt: new Date()
    };
    this.activities.set(activity.id, activity);
    return activity;
  }

  // System Stats
  async getSystemStats(): Promise<SystemStats | undefined> {
    if (!this.systemStats) {
      return await this.updateSystemStatsFromData();
    }
    return this.systemStats;
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats> {
    if (!this.systemStats) {
      this.systemStats = {
        id: 1,
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0,
        lastUpdated: new Date()
      };
    }
    
    this.systemStats = {
      ...this.systemStats,
      ...stats,
      lastUpdated: new Date()
    };
    return this.systemStats;
  }

  private async updateSystemStatsFromData(): Promise<SystemStats> {
    const allPairs = Array.from(this.pairs.values());
    const allSessions = Array.from(this.sessions.values());
    
    const activePairs = allPairs.filter(p => p.status === "active").length;
    const totalMessages = allPairs.reduce((sum, p) => sum + (p.messageCount || 0), 0);
    const blockedMessages = allPairs.reduce((sum, p) => sum + (p.blockedCount || 0), 0);
    const activeSessions = allSessions.filter(s => s.status === "active").length;

    return await this.updateSystemStats({
      activePairs,
      totalMessages,
      blockedMessages,
      activeSessions,
    });
  }
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Pairs
  async getAllPairs(): Promise<Pair[]> {
    return await db.select().from(pairs);
  }

  async getPair(id: number): Promise<Pair | undefined> {
    const [pair] = await db.select().from(pairs).where(eq(pairs.id, id));
    return pair;
  }

  async createPair(insertPair: InsertPair): Promise<Pair> {
    const [pair] = await db.insert(pairs).values(insertPair).returning();
    
    // Log activity
    await this.createActivity({
      type: "pair_created",
      message: `Created new pair: ${pair.name}`,
      pairId: pair.id,
      severity: "success"
    });
    
    return pair;
  }

  async updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined> {
    const [pair] = await db
      .update(pairs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pairs.id, id))
      .returning();
    return pair;
  }

  async deletePair(id: number): Promise<boolean> {
    const result = await db.delete(pairs).where(eq(pairs.id, id));
    return result.rowCount > 0;
  }

  // Sessions
  async getAllSessions(): Promise<Session[]> {
    return await db.select().from(sessions);
  }

  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.name, name));
    return session;
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const [session] = await db.insert(sessions).values(insertSession).returning();
    return session;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const [session] = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, id))
      .returning();
    return session;
  }

  async deleteSession(id: number): Promise<boolean> {
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return result.rowCount > 0;
  }

  // Blocklists
  async getAllBlocklists(): Promise<Blocklist[]> {
    return await db.select().from(blocklists);
  }

  async getBlocklistsByType(type: string): Promise<Blocklist[]> {
    return await db.select().from(blocklists).where(eq(blocklists.type, type));
  }

  async getGlobalBlocklists(): Promise<Blocklist[]> {
    return await db.select().from(blocklists).where(isNull(blocklists.pairId));
  }

  async getPairBlocklists(pairId: number): Promise<Blocklist[]> {
    return await db.select().from(blocklists).where(eq(blocklists.pairId, pairId));
  }

  async createBlocklist(insertBlocklist: InsertBlocklist): Promise<Blocklist> {
    const [blocklist] = await db.insert(blocklists).values(insertBlocklist).returning();
    return blocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    const result = await db.delete(blocklists).where(eq(blocklists.id, id));
    return result.rowCount > 0;
  }

  // Activities
  async getRecentActivities(limit: number = 50): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    return activity;
  }

  // System Stats
  async getSystemStats(): Promise<SystemStats | undefined> {
    const [stats] = await db.select().from(systemStats).limit(1);
    if (!stats) {
      // Create initial stats if none exist
      return await this.updateSystemStatsFromData();
    }
    return stats;
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats> {
    const existing = await db.select().from(systemStats).limit(1);
    
    if (existing.length === 0) {
      const [newStats] = await db
        .insert(systemStats)
        .values({ ...stats, lastUpdated: new Date() })
        .returning();
      return newStats;
    } else {
      const [updatedStats] = await db
        .update(systemStats)
        .set({ ...stats, lastUpdated: new Date() })
        .where(eq(systemStats.id, existing[0].id))
        .returning();
      return updatedStats;
    }
  }

  private async updateSystemStatsFromData(): Promise<SystemStats> {
    const allPairs = await db.select().from(pairs);
    const allSessions = await db.select().from(sessions);
    
    const activePairs = allPairs.filter(p => p.status === "active").length;
    const totalMessages = allPairs.reduce((sum, p) => sum + (p.messageCount || 0), 0);
    const blockedMessages = allPairs.reduce((sum, p) => sum + (p.blockedCount || 0), 0);
    const activeSessions = allSessions.filter(s => s.status === "active").length;

    return await this.updateSystemStats({
      activePairs,
      totalMessages,
      blockedMessages,
      activeSessions,
    });
  }
}

// Use in-memory storage for development (will switch to database when DATABASE_URL is provided)
export const storage = new MemStorage();