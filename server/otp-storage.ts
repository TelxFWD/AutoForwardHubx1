/**
 * OTP Session Storage
 * Manages temporary OTP data between request and verification
 */

interface OTPSession {
  phoneNumber: string;
  sessionName: string;
  phoneCodeHash: string;
  timestamp: number;
  expiresAt: number;
}

export class OTPStorage {
  private otpSessions = new Map<string, OTPSession>();
  private readonly EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes
  
  constructor() {
    // Clean up expired sessions every minute
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000);
  }

  storeOTPSession(phoneNumber: string, sessionName: string, phoneCodeHash: string): void {
    const now = Date.now();
    const session: OTPSession = {
      phoneNumber,
      sessionName,
      phoneCodeHash,
      timestamp: now,
      expiresAt: now + this.EXPIRY_TIME
    };
    
    // Use phone number as key for easy lookup
    this.otpSessions.set(phoneNumber, session);
    console.log(`OTP session stored for ${phoneNumber}, expires at ${new Date(session.expiresAt).toISOString()}`);
  }

  getOTPSession(phoneNumber: string): OTPSession | null {
    const session = this.otpSessions.get(phoneNumber);
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.otpSessions.delete(phoneNumber);
      console.log(`OTP session expired for ${phoneNumber}`);
      return null;
    }
    
    return session;
  }

  removeOTPSession(phoneNumber: string): boolean {
    return this.otpSessions.delete(phoneNumber);
  }

  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    
    const entries = Array.from(this.otpSessions.entries());
    for (const [phoneNumber, session] of entries) {
      if (now > session.expiresAt) {
        this.otpSessions.delete(phoneNumber);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired OTP sessions`);
    }
  }

  getActiveSessionsCount(): number {
    return this.otpSessions.size;
  }

  getAllActiveSessions(): { phoneNumber: string; sessionName: string; expiresIn: number }[] {
    const now = Date.now();
    const entries = Array.from(this.otpSessions.entries());
    return entries.map(([phoneNumber, session]) => ({
      phoneNumber,
      sessionName: session.sessionName,
      expiresIn: Math.max(0, session.expiresAt - now)
    }));
  }
}

// Export singleton instance
export const otpStorage = new OTPStorage();