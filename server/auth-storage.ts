import { 
  type User, type InsertUser, type UserSession, type InsertUserSession,
  type PinLogin, type CreateUser
} from "@shared/schema";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export interface IAuthStorage {
  // User management
  createUser(data: CreateUser): Promise<User>;
  authenticateUser(pin: string): Promise<User | null>;
  getUserByPin(pin: string): Promise<User | null>;
  getUserById(id: number): Promise<User | null>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: number): Promise<boolean>;
  
  // Session management
  createUserSession(userId: number): Promise<UserSession>;
  validateSession(token: string): Promise<User | null>;
  deleteSession(token: string): Promise<boolean>;
  cleanupExpiredSessions(): Promise<void>;
}

export class AuthStorage implements IAuthStorage {
  private userSessions = new Map<string, UserSession>();
  private sessionIdCounter = 1;

  constructor() {
    // Initialize default users if they don't exist
    this.initializeDefaultUsers();
  }

  private async initializeDefaultUsers() {
    try {
      // Check if admin user already exists
      const adminUser = await storage.getUserByPin("1234");
      if (!adminUser) {
        const hashedPin = await bcrypt.hash("1234", 10);
        await storage.createUser({
          pin: "1234",
          pinHash: hashedPin,
          displayName: "Admin User",
          isActive: true,
        });
      }

      // Check if default user exists
      const defaultUser = await storage.getUserByPin("0000");
      if (!defaultUser) {
        const hashedPin = await bcrypt.hash("0000", 10);
        await storage.createUser({
          pin: "0000",
          pinHash: hashedPin,
          displayName: "Test User",
          isActive: true,
        });
      }
    } catch (error) {
      console.log("Using existing users from storage");
    }
  }

  async createUser(data: CreateUser): Promise<User> {
    const hashedPin = await bcrypt.hash(data.pin, 10);
    return await storage.createUser({
      pin: data.pin,
      pinHash: hashedPin,
      displayName: data.displayName || null,
      isActive: true,
    });
  }

  async authenticateUser(pin: string): Promise<User | null> {
    const user = await storage.getUserByPin(pin);
    if (!user || !user.isActive) {
      return null;
    }
    
    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async getUserByPin(pin: string): Promise<User | null> {
    const user = await storage.getUserByPin(pin);
    return user || null;
  }

  async getUserById(id: number): Promise<User | null> {
    const user = await storage.getUser(id);
    return user || null;
  }

  async getAllUsers(): Promise<User[]> {
    // For in-memory storage, we need to get users differently
    // Since storage interface doesn't have getAllUsers, we'll simulate it
    const users: User[] = [];
    
    // Try to get known user IDs (this is a limitation of the current interface)
    for (let i = 1; i <= 10; i++) {
      try {
        const user = await storage.getUser(i);
        if (user) {
          users.push(user);
        }
      } catch (error) {
        // User doesn't exist, continue
      }
    }
    
    return users;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    // This would require an updateUser method in the storage interface
    // For now, return null as this operation isn't supported
    return null;
  }

  async deleteUser(id: number): Promise<boolean> {
    // This would require a deleteUser method in the storage interface
    // For now, return false as this operation isn't supported
    return false;
  }

  async createUserSession(userId: number): Promise<UserSession> {
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    const session: UserSession = {
      id: this.sessionIdCounter++,
      userId,
      sessionToken,
      expiresAt,
      createdAt: new Date(),
    };
    
    this.userSessions.set(sessionToken, session);
    return session;
  }

  async validateSession(token: string): Promise<User | null> {
    const session = this.userSessions.get(token);
    if (!session) {
      return null;
    }
    
    if (session.expiresAt < new Date()) {
      this.userSessions.delete(token);
      return null;
    }
    
    return await this.getUserById(session.userId);
  }

  async deleteSession(token: string): Promise<boolean> {
    return this.userSessions.delete(token);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [token, session] of Array.from(this.userSessions.entries())) {
      if (session.expiresAt < now) {
        this.userSessions.delete(token);
      }
    }
  }
}

export const authStorage = new AuthStorage();