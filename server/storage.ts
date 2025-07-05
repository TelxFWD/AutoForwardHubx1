import { 
  users, pairs, sessions, blocklists, messageMappings, activities, systemStats, otpVerification,
  type User, type InsertUser, type Pair, type InsertPair, type InsertTelegramPair, type InsertDiscordPair,
  type Session, type InsertSession, type Blocklist, type InsertBlocklist,
  type Activity, type InsertActivity, type SystemStats, type OtpVerification, type InsertOtpVerification
} from "@shared/schema";
import { db } from "./db";
import { eq, isNull, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByPin(pin: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Pairs
  getAllPairs(userId?: number): Promise<Pair[]>;
  getPair(id: number): Promise<Pair | undefined>;
  createPair(pair: InsertPair): Promise<Pair>;
  updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined>;
  deletePair(id: number): Promise<boolean>;

  // Sessions
  getAllSessions(userId?: number): Promise<Session[]>;
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

  // OTP Verification
  getOtpVerification(phoneNumber: string): Promise<OtpVerification | undefined>;
  createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification>;
  updateOtpVerification(phoneNumber: string, updates: Partial<OtpVerification>): Promise<OtpVerification | undefined>;
  deleteOtpVerification(phoneNumber: string): Promise<boolean>;
  cleanExpiredOtpVerifications(): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
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
    const [newUser] = await db.insert(users).values(user).returning();
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
    const [newPair] = await db.insert(pairs).values(pair).returning();
    return newPair;
  }

  async updatePair(id: number, updates: Partial<Pair>): Promise<Pair | undefined> {
    if (!db) throw new Error("Database not available");
    const [updatedPair] = await db
      .update(pairs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pairs.id, id))
      .returning();
    return updatedPair || undefined;
  }

  async deletePair(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(pairs).where(eq(pairs.id, id));
    return (result.rowCount || 0) > 0;
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
    const [newSession] = await db.insert(sessions).values(session).returning();
    return newSession;
  }

  async updateSession(id: number, updates: Partial<Session>): Promise<Session | undefined> {
    if (!db) throw new Error("Database not available");
    const [updatedSession] = await db
      .update(sessions)
      .set(updates)
      .where(eq(sessions.id, id))
      .returning();
    return updatedSession || undefined;
  }

  async deleteSession(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(sessions).where(eq(sessions.id, id));
    return (result.rowCount || 0) > 0;
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
    const [newBlocklist] = await db.insert(blocklists).values(blocklist).returning();
    return newBlocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    if (!db) throw new Error("Database not available");
    const result = await db.delete(blocklists).where(eq(blocklists.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getRecentActivities(limit = 50): Promise<Activity[]> {
    if (!db) throw new Error("Database not available");
    return await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    if (!db) throw new Error("Database not available");
    const [newActivity] = await db.insert(activities).values({
      ...activity,
      severity: activity.severity || "info",
      details: activity.details || null,
      pairId: activity.pairId || null,
      sessionId: activity.sessionId || null,
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
    const [updatedStats] = await db
      .insert(systemStats)
      .values({ ...stats, lastUpdated: new Date() })
      .onConflictDoUpdate({
        target: systemStats.id,
        set: { ...stats, lastUpdated: new Date() },
      })
      .returning();
    return updatedStats;
  }

  // OTP Verification methods
  async getOtpVerification(phoneNumber: string): Promise<OtpVerification | undefined> {
    if (!db) throw new Error("Database not available");
    const [verification] = await db
      .select()
      .from(otpVerification)
      .where(eq(otpVerification.phoneNumber, phoneNumber))
      .limit(1);
    return verification || undefined;
  }

  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    if (!db) throw new Error("Database not available");
    
    // First, delete any existing verification for this phone number
    await db
      .delete(otpVerification)
      .where(eq(otpVerification.phoneNumber, otp.phoneNumber));
    
    // Create new verification
    const [newVerification] = await db
      .insert(otpVerification)
      .values({
        phoneNumber: otp.phoneNumber,
        phoneCodeHash: otp.phoneCodeHash,
        sessionName: otp.sessionName,
        userId: otp.userId,
        status: otp.status || "pending",
        expiresAt: otp.expiresAt,
      })
      .returning();
    return newVerification;
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
    return (result.rowCount || 0) > 0;
  }

  async cleanExpiredOtpVerifications(): Promise<void> {
    if (!db) throw new Error("Database not available");
    const now = new Date();
    await db
      .delete(otpVerification)
      .where(eq(otpVerification.expiresAt, now));
  }
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users = new Map<number, User>();
  private pairs = new Map<number, Pair>();
  private sessions = new Map<number, Session>();
  private blocklists = new Map<number, Blocklist>();
  private activities = new Map<number, Activity>();
  private otpVerifications = new Map<string, OtpVerification>();
  private systemStats: SystemStats | undefined;
  private nextUserId = 1;
  private nextPairId = 1;
  private nextSessionId = 1;
  private nextBlocklistId = 1;
  private nextActivityId = 1;
  private nextOtpId = 1;

  constructor() {
    this.initializeUsers();
  }
  
  private async initializeUsers() {
    try {
      const bcrypt = await import('bcryptjs');
      // Initialize with properly hashed PINs
      await this.createUser({
        pin: "1234",
        pinHash: await bcrypt.hash("1234", 10),
        displayName: "Admin User",
        isActive: true,
      });
      
      await this.createUser({
        pin: "0000",
        pinHash: await bcrypt.hash("0000", 10),
        displayName: "Test User",
        isActive: true,
      });
      
      await this.createUser({
        pin: "5599",
        pinHash: await bcrypt.hash("5599", 10),
        displayName: "Main User",
        isActive: true,
      });
    } catch (error) {
      console.log("Error initializing users:", error);
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByPin(pin: string): Promise<User | undefined> {
    for (const user of Array.from(this.users.values())) {
      if (user.pin === pin) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      id: this.nextUserId++,
      pin: user.pin,
      pinHash: user.pinHash,
      displayName: user.displayName ?? null,
      isActive: user.isActive ?? true,
      lastLogin: null,
      createdAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getAllPairs(userId?: number): Promise<Pair[]> {
    const allPairs = Array.from(this.pairs.values());
    if (userId) {
      return allPairs.filter(pair => pair.userId === userId);
    }
    return allPairs;
  }

  async getPair(id: number): Promise<Pair | undefined> {
    return this.pairs.get(id);
  }

  async createPair(pair: InsertPair): Promise<Pair> {
    const newPair: Pair = {
      ...pair,
      id: this.nextPairId++,
      messageCount: 0,
      blockedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: pair.status || "active",
      enableAI: pair.enableAI || false,
      pairType: pair.pairType || "telegram",
      discordWebhook: pair.discordWebhook ?? null,
      botToken: pair.botToken ?? null,
      removeMentions: pair.removeMentions ?? null,
      headerPatterns: pair.headerPatterns ?? null,
      footerPatterns: pair.footerPatterns ?? null,
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

  async getAllSessions(userId?: number): Promise<Session[]> {
    const allSessions = Array.from(this.sessions.values());
    if (userId) {
      return allSessions.filter(session => session.userId === userId);
    }
    return allSessions;
  }

  async getSession(id: number): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async getSessionByName(name: string): Promise<Session | undefined> {
    for (const session of Array.from(this.sessions.values())) {
      if (session.name === name) {
        return session;
      }
    }
    return undefined;
  }

  async createSession(session: InsertSession): Promise<Session> {
    const newSession: Session = {
      id: this.nextSessionId++,
      lastActive: new Date(),
      createdAt: new Date(),
      status: session.status || "active",
      ...session,
    };
    this.sessions.set(newSession.id, newSession);
    return newSession;
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

  async getAllBlocklists(): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values());
  }

  async getBlocklistsByType(type: string): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(bl => bl.type === type);
  }

  async getGlobalBlocklists(): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(bl => bl.pairId === null);
  }

  async getPairBlocklists(pairId: number): Promise<Blocklist[]> {
    return Array.from(this.blocklists.values()).filter(bl => bl.pairId === pairId);
  }

  async createBlocklist(blocklist: InsertBlocklist): Promise<Blocklist> {
    const newBlocklist: Blocklist = {
      id: this.nextBlocklistId++,
      createdAt: new Date(),
      isActive: blocklist.isActive !== undefined ? blocklist.isActive : true,
      pairId: blocklist.pairId || null,
      ...blocklist,
    };
    this.blocklists.set(newBlocklist.id, newBlocklist);
    return newBlocklist;
  }

  async deleteBlocklist(id: number): Promise<boolean> {
    return this.blocklists.delete(id);
  }

  async getRecentActivities(limit = 50): Promise<Activity[]> {
    return Array.from(this.activities.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .slice(0, limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const newActivity: Activity = {
      id: this.nextActivityId++,
      createdAt: new Date(),
      severity: activity.severity || "info",
      details: activity.details || null,
      pairId: activity.pairId || null,
      sessionId: activity.sessionId || null,
      ...activity,
    };
    this.activities.set(newActivity.id, newActivity);
    return newActivity;
  }

  async getSystemStats(): Promise<SystemStats | undefined> {
    if (!this.systemStats) {
      this.systemStats = {
        id: 1,
        activePairs: this.pairs.size,
        totalMessages: 0,
        blockedMessages: 0,
        activeSessions: this.sessions.size,
        lastUpdated: new Date(),
      };
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
        lastUpdated: new Date(),
      };
    }
    
    this.systemStats = {
      ...this.systemStats,
      ...stats,
      lastUpdated: new Date(),
    };
    
    return this.systemStats;
  }

  // OTP Verification methods for MemStorage
  async getOtpVerification(phoneNumber: string): Promise<OtpVerification | undefined> {
    return this.otpVerifications.get(phoneNumber);
  }

  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    // Delete any existing verification for this phone number
    this.otpVerifications.delete(otp.phoneNumber);
    
    const newVerification: OtpVerification = {
      id: this.nextOtpId++,
      phoneNumber: otp.phoneNumber,
      phoneCodeHash: otp.phoneCodeHash,
      sessionName: otp.sessionName,
      userId: otp.userId || null,
      status: otp.status || "pending",
      expiresAt: otp.expiresAt,
      createdAt: new Date(),
    };
    
    this.otpVerifications.set(otp.phoneNumber, newVerification);
    return newVerification;
  }

  async updateOtpVerification(phoneNumber: string, updates: Partial<OtpVerification>): Promise<OtpVerification | undefined> {
    const existing = this.otpVerifications.get(phoneNumber);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.otpVerifications.set(phoneNumber, updated);
    return updated;
  }

  async deleteOtpVerification(phoneNumber: string): Promise<boolean> {
    return this.otpVerifications.delete(phoneNumber);
  }

  async cleanExpiredOtpVerifications(): Promise<void> {
    const now = new Date();
    const expiredPhones: string[] = [];
    
    this.otpVerifications.forEach((verification, phoneNumber) => {
      if (verification.expiresAt <= now) {
        expiredPhones.push(phoneNumber);
      }
    });
    
    expiredPhones.forEach(phoneNumber => {
      this.otpVerifications.delete(phoneNumber);
    });
  }
}

// Export storage instance - use database if available, otherwise in-memory
export const storage: IStorage = db ? new DatabaseStorage() : new MemStorage();

// For dev purposes, log which storage is being used
if (db) {
  console.log("🗄️  Using DatabaseStorage");
} else {
  console.log("💾 Using MemStorage (in-memory)");
}