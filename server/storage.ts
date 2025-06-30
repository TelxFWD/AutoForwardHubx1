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

// Database storage implementation
export class DatabaseStorage implements IStorage {
  constructor() {}

  async getUser(id: number): Promise<User | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not available");
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getAllPairs(): Promise<Pair[]> {
    if (!db) {
      // Fallback to sample data if database not available
      return [{
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
      }];
    }
    return await db.select().from(pairs).orderBy(desc(pairs.createdAt));
  }

  async getPair(id: number): Promise<Pair | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(pairs).where(eq(pairs.id, id));
    return result[0];
  }

  async createPair(pair: InsertPair): Promise<Pair> {
    if (!db) throw new Error("Database not available");
    const result = await db.insert(pairs).values(pair).returning();
    return result[0];
  }

  async updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined> {
    if (!db) return undefined;
    const result = await db.update(pairs).set({...updates, updatedAt: new Date()}).where(eq(pairs.id, id)).returning();
    return result[0];
  }

  async deletePair(id: number): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(pairs).where(eq(pairs.id, id));
    return result.rowCount > 0;
  }

  async getAllSessions(): Promise<Session[]> {
    if (!db) {
      // Fallback to sample data
      return [{
        id: 1,
        name: "Main Session",
        phone: "+1234567890",
        sessionFile: "sessions/main.session",
        status: "active",
        lastActive: new Date(),
        createdAt: new Date()
      }];
    }
    return await db.select().from(sessions).orderBy(desc(sessions.createdAt));
  }

  async getSession(id: number): Promise<Session | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(sessions).where(eq(sessions.id, id));
    return result[0];
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    if (!db) return undefined;
    const result = await db.select().from(sessions).where(eq(sessions.name, name));
    return result[0];
  }

  async createSession(session: InsertSession): Promise<Session> {
    if (!db) throw new Error("Database not available");
    const result = await db.insert(sessions).values(session).returning();
    return result[0];
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    if (!db) return undefined;
    const result = await db.update(sessions).set({...updates, lastActive: new Date()}).where(eq(sessions.id, id)).returning();
    return result[0];
  }

  async deleteSession(id: number): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return result.rowCount > 0;
  }

  async getAllBlocklists(): Promise<Blocklist[]> {
    if (!db) return [];
    return await db.select().from(blocklists).orderBy(desc(blocklists.createdAt));
  }

  async getBlocklistsByType(type: string): Promise<Blocklist[]> {
    if (!db) return [];
    return await db.select().from(blocklists).where(eq(blocklists.type, type));
  }

  async getGlobalBlocklists(): Promise<Blocklist[]> {
    if (!db) return [];
    return await db.select().from(blocklists).where(isNull(blocklists.pairId));
  }

  async getPairBlocklists(pairId: number): Promise<Blocklist[]> {
    if (!db) return [];
    return await db.select().from(blocklists).where(eq(blocklists.pairId, pairId));
  }

  async createBlocklist(blocklist: InsertBlocklist): Promise<Blocklist> {
    if (!db) throw new Error("Database not available");
    const result = await db.insert(blocklists).values(blocklist).returning();
    return result[0];
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(blocklists).where(eq(blocklists.id, id));
    return result.rowCount > 0;
  }

  async getRecentActivities(limit: number = 100): Promise<Activity[]> {
    if (!db) return [];
    return await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    if (!db) {
      // Return mock activity if database not available
      return {
        id: Math.floor(Math.random() * 1000),
        ...activity,
        createdAt: new Date()
      };
    }
    const result = await db.insert(activities).values(activity).returning();
    return result[0];
  }

  async getSystemStats(): Promise<SystemStats | undefined> {
    if (!db) {
      // Return mock stats if database not available
      return {
        id: 1,
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0,
        lastUpdated: new Date()
      };
    }
    const result = await db.select().from(systemStats).limit(1);
    if (result.length === 0) {
      // Create initial stats
      const newStats = await db.insert(systemStats).values({
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0
      }).returning();
      return newStats[0];
    }
    return result[0];
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats> {
    if (!db) throw new Error("Database not available");
    
    const existing = await this.getSystemStats();
    if (!existing) {
      const newStats = await db.insert(systemStats).values({
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0,
        ...stats
      }).returning();
      return newStats[0];
    }
    
    const result = await db.update(systemStats).set({...stats, lastUpdated: new Date()}).where(eq(systemStats.id, existing.id)).returning();
    return result[0];
  }
}

// In-memory storage implementation for fallback
export class MemStorage implements IStorage {
  private users = new Map<number, User>();
  private pairs = new Map<number, Pair>();
  private sessions = new Map<number, Session>();
  private blocklists = new Map<number, Blocklist>();
  private activities = new Map<number, Activity>();
  private systemStats: SystemStats | null = null;
  private nextId = 1;

  constructor() {
    this.seedData();
  }

  private seedData() {
    this.systemStats = {
      id: 1,
      activePairs: 0,
      totalMessages: 0,
      blockedMessages: 0,
      activeSessions: 0,
      lastUpdated: new Date()
    };

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

    const sampleSession: Session = {
      id: 1,
      name: "Main Session",
      phone: "+1234567890",
      sessionFile: "sessions/main.session",
      status: "active",
      lastActive: new Date(),
      createdAt: new Date()
    };

    this.pairs.set(1, samplePair);
    this.sessions.set(1, sampleSession);
    this.nextId = 2;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { id: this.nextId++, ...user };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getAllPairs(): Promise<Pair[]> {
    return Array.from(this.pairs.values());
  }

  async getPair(id: number): Promise<Pair | undefined> {
    return this.pairs.get(id);
  }

  async createPair(pair: InsertPair): Promise<Pair> {
    const newPair: Pair = {
      id: this.nextId++,
      ...pair,
      messageCount: 0,
      blockedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.pairs.set(newPair.id, newPair);
    return newPair;
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

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    for (const session of this.sessions.values()) {
      if (session.name === name) return session;
    }
    return undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const newSession: Session = {
      id: this.nextId++,
      ...session,
      lastActive: new Date(),
      createdAt: new Date()
    };
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const updatedSession = { ...session, ...updates, lastActive: new Date() };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async deleteSession(id: number): Promise<boolean> {
    return this.sessions.delete(id);
  }

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

  async createBlocklist(blocklist: InsertBlocklist): Promise<Blocklist> {
    const newBlocklist: Blocklist = {
      id: this.nextId++,
      ...blocklist,
      createdAt: new Date()
    };
    this.blocklists.set(newBlocklist.id, newBlocklist);
    return newBlocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    return this.blocklists.delete(id);
  }

  async getRecentActivities(limit: number = 100): Promise<Activity[]> {
    return Array.from(this.activities.values()).slice(0, limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const newActivity: Activity = {
      id: this.nextId++,
      ...activity,
      createdAt: new Date()
    };
    this.activities.set(newActivity.id, newActivity);
    return newActivity;
  }

  async getSystemStats(): Promise<SystemStats | undefined> {
    return this.systemStats || undefined;
  }

  async updateSystemStats(stats: Partial<SystemStats>): Promise<SystemStats> {
    if (!this.systemStats) {
      this.systemStats = {
        id: 1,
        activePairs: 0,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: 0,
        lastUpdated: new Date(),
        ...stats
      };
    } else {
      this.systemStats = { ...this.systemStats, ...stats, lastUpdated: new Date() };
    }
    return this.systemStats;
  }
}

// Use database storage if available, fallback to memory storage
export const storage = db ? new DatabaseStorage() : new MemStorage();