import { 
  users, userSessions,
  type User, type InsertUser, type UserSession, type InsertUserSession,
  type PinLogin, type CreateUser
} from "@shared/schema";
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

export class MemAuthStorage implements IAuthStorage {
  private users = new Map<number, User>();
  private userSessions = new Map<string, UserSession>();
  private userIdCounter = 1;
  private sessionIdCounter = 1;

  constructor() {
    // Create default admin user with PIN 1234
    this.initializeDefaultAdmin();
  }

  private async initializeDefaultAdmin() {
    const adminPin = "1234";
    const hashedPin = await bcrypt.hash(adminPin, 10);
    
    const adminUser: User = {
      id: this.userIdCounter++,
      pin: adminPin,
      pinHash: hashedPin,
      displayName: "Admin User",
      isActive: true,
      lastLogin: null,
      createdAt: new Date()
    };
    
    this.users.set(adminUser.id, adminUser);
  }

  async createUser(data: CreateUser): Promise<User> {
    // Check if PIN already exists
    for (const user of this.users.values()) {
      if (user.pin === data.pin) {
        throw new Error("PIN already exists");
      }
    }

    const hashedPin = await bcrypt.hash(data.pin, 10);
    
    const newUser: User = {
      id: this.userIdCounter++,
      pin: data.pin,
      pinHash: hashedPin,
      displayName: data.displayName || `User ${data.pin}`,
      isActive: true,
      lastLogin: null,
      createdAt: new Date()
    };

    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async authenticateUser(pin: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.pin === pin && user.isActive) {
        const isValid = await bcrypt.compare(pin, user.pinHash);
        if (isValid) {
          // Update last login
          user.lastLogin = new Date();
          this.users.set(user.id, user);
          return user;
        }
      }
    }
    return null;
  }

  async getUserByPin(pin: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.pin === pin && user.isActive) {
        return user;
      }
    }
    return null;
  }

  async getUserById(id: number): Promise<User | null> {
    const user = this.users.get(id);
    return user && user.isActive ? user : null;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.isActive);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;

    // Soft delete by setting isActive to false
    user.isActive = false;
    this.users.set(id, user);
    
    // Clean up user sessions
    for (const [token, session] of this.userSessions.entries()) {
      if (session.userId === id) {
        this.userSessions.delete(token);
      }
    }
    
    return true;
  }

  async createUserSession(userId: number): Promise<UserSession> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour sessions

    const session: UserSession = {
      id: this.sessionIdCounter++,
      userId,
      sessionToken: token,
      expiresAt,
      createdAt: new Date()
    };

    this.userSessions.set(token, session);
    return session;
  }

  async validateSession(token: string): Promise<User | null> {
    const session = this.userSessions.get(token);
    if (!session) return null;

    // Check if session expired
    if (session.expiresAt < new Date()) {
      this.userSessions.delete(token);
      return null;
    }

    return this.getUserById(session.userId);
  }

  async deleteSession(token: string): Promise<boolean> {
    return this.userSessions.delete(token);
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [token, session] of this.userSessions.entries()) {
      if (session.expiresAt < now) {
        this.userSessions.delete(token);
      }
    }
  }
}

export const authStorage = new MemAuthStorage();