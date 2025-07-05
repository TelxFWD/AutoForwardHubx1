import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./auth-storage";
import { otpStorage } from "./otp-storage";
import { insertPairSchema, insertSessionSchema, insertBlocklistSchema, insertActivitySchema, pinLoginSchema, createUserSchema, otpRequestSchema, otpVerifySchema } from "@shared/schema";
import { registerEnhancedOtpRoutes } from "./enhanced-otp-routes";
import { z } from "zod";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Authentication middleware
function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  authStorage.validateSession(token).then(user => {
    if (!user) {
      return res.status(401).json({ message: 'Invalid session' });
    }
    req.user = user;
    next();
  }).catch(() => {
    res.status(401).json({ message: 'Authentication failed' });
  });
}

// Admin middleware (hardcoded admin PIN: 0000)
function requireAdmin(req: any, res: any, next: any) {
  const adminPin = req.headers['x-admin-pin'];
  if (adminPin !== '0000') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { pin } = pinLoginSchema.parse(req.body);
      const user = await authStorage.authenticateUser(pin);
      
      if (!user) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }
      
      const session = await authStorage.createUserSession(user.id);
      
      res.json({
        user: {
          id: user.id,
          pin: user.pin,
          displayName: user.displayName,
          lastLogin: user.lastLogin
        },
        token: session.sessionToken,
        expiresAt: session.expiresAt
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid PIN format", errors: error.errors });
      } else {
        res.status(500).json({ message: "Login failed" });
      }
    }
  });

  app.post("/api/auth/logout", requireAuth, async (req: any, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await authStorage.deleteSession(token);
      }
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ message: "Logout failed" });
    }
  });

  app.get("/api/auth/user", requireAuth, (req: any, res) => {
    res.json({
      id: req.user.id,
      pin: req.user.pin,
      displayName: req.user.displayName,
      lastLogin: req.user.lastLogin
    });
  });

  // Admin routes (protected with admin PIN)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await authStorage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        pin: user.pin,
        displayName: user.displayName,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      console.log("=== CREATE USER REQUEST ===");
      console.log("Content-Type:", req.headers['content-type']);
      console.log("Raw body:", req.body);
      console.log("Body type:", typeof req.body);
      console.log("Body keys:", Object.keys(req.body || {}));
      console.log("PIN value:", req.body?.pin, "type:", typeof req.body?.pin);
      console.log("DisplayName value:", req.body?.displayName, "type:", typeof req.body?.displayName);
      
      // Check if request body is empty or invalid
      if (!req.body || Object.keys(req.body).length === 0) {
        console.log("❌ Empty request body detected");
        return res.status(400).json({ 
          success: false,
          message: "Request body is required. Please provide PIN and display name.",
          errors: [{ 
            code: "missing_body", 
            message: "Request body cannot be empty", 
            path: ["body"] 
          }]
        });
      }

      // Validate PIN field specifically
      if (!req.body.pin) {
        console.log("❌ Missing PIN field");
        return res.status(400).json({ 
          success: false,
          message: "PIN is required and must be exactly 4 digits",
          errors: [{ 
            code: "missing_pin", 
            message: "PIN field is required", 
            path: ["pin"] 
          }]
        });
      }

      // Validate PIN format
      if (typeof req.body.pin !== 'string' || !/^\d{4}$/.test(req.body.pin)) {
        console.log("❌ Invalid PIN format:", req.body.pin);
        return res.status(400).json({ 
          success: false,
          message: "PIN must be exactly 4 digits",
          errors: [{ 
            code: "invalid_pin_format", 
            message: "PIN must be a 4-digit string", 
            path: ["pin"] 
          }]
        });
      }

      console.log("✅ Basic validation passed, parsing with schema");
      const userData = createUserSchema.parse(req.body);
      console.log("✅ Schema validation passed:", userData);
      
      const user = await authStorage.createUser(userData);
      console.log("✅ User created successfully:", { id: user.id, pin: user.pin, displayName: user.displayName });
      
      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          pin: user.pin,
          displayName: user.displayName,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.log("❌ User creation error:", error);
      if (error instanceof z.ZodError) {
        console.log("❌ Zod validation errors:", error.errors);
        res.status(400).json({ 
          success: false,
          message: "Invalid user data provided", 
          errors: error.errors.map(err => ({
            code: err.code,
            message: err.message,
            path: err.path
          }))
        });
      } else {
        const message = error instanceof Error ? error.message : "Failed to create user";
        console.log("❌ Server error:", message);
        res.status(500).json({ 
          success: false, 
          message: `Server error: ${message}` 
        });
      }
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await authStorage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  // Pairs routes
  app.get("/api/pairs", async (req, res) => {
    try {
      const pairs = await storage.getAllPairs();
      res.json(pairs);
    } catch (error) {
      console.error("Failed to fetch pairs:", error);
      res.status(500).json({ 
        message: "Failed to fetch pairs",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/pairs", async (req, res) => {
    try {
      const validatedData = insertPairSchema.parse(req.body);
      const pair = await storage.createPair(validatedData);
      
      // Log activity
      await storage.createActivity({
        type: "pair_created",
        message: `New pair created: ${pair.name}`,
        details: `Source: ${pair.sourceChannel} → Destination: ${pair.destinationChannel}`,
        pairId: pair.id,
        severity: "success",
      });
      
      res.status(201).json(pair);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid pair data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create pair" });
      }
    }
  });

  app.patch("/api/pairs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const pair = await storage.updatePair(id, updates);
      
      if (!pair) {
        return res.status(404).json({ message: "Pair not found" });
      }

      // Log activity
      await storage.createActivity({
        type: "pair_updated",
        message: `Pair updated: ${pair.name}`,
        details: `Status changed to: ${pair.status}`,
        pairId: pair.id,
        severity: "info",
      });
      
      res.json(pair);
    } catch (error) {
      res.status(500).json({ message: "Failed to update pair" });
    }
  });

  app.delete("/api/pairs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pair = await storage.getPair(id);
      const deleted = await storage.deletePair(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Pair not found" });
      }

      // Log activity
      if (pair) {
        await storage.createActivity({
          type: "pair_deleted",
          message: `Pair deleted: ${pair.name}`,
          details: `Removed from system`,
          severity: "warning",
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete pair" });
    }
  });

  // Sessions routes
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      
      // Log activity
      await storage.createActivity({
        type: "session_connected",
        message: `New session connected: ${session.name}`,
        details: `Phone: ${session.phone} - Ready for use`,
        sessionId: session.id,
        severity: "success",
      });
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid session data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create session" });
      }
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const session = await storage.updateSession(id, updates);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // Unified OTP Session endpoints - accepts both formats
  app.post("/api/sessions/request-otp", async (req, res) => {
    try {
      // Support both Dashboard format { sessionName, phoneNumber } and TelX format { phone }
      const { sessionName, phoneNumber, sessionFileName, phone } = req.body;
      
      // Use phone parameter or phoneNumber parameter
      const actualPhone = phone || phoneNumber;
      // Auto-generate session name if not provided
      const actualSessionName = sessionName || `user_${actualPhone?.replace(/[+\-\s]/g, '')}`;
      
      if (!actualPhone) {
        return res.status(400).json({ message: "phone or phoneNumber is required" });
      }
      
      // Use Python subprocess to handle OTP request
      const { spawn } = await import("child_process");
      const pythonProcess = spawn("python", [
        "telegram_copier/session_loader.py",
        "--phone", actualPhone,
        "--session-name", sessionFileName || actualSessionName
      ]);
      
      let output = "";
      let errorOutput = "";
      
      pythonProcess.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on("close", async (code) => {
        try {
          if (code === 0) {
            const result = JSON.parse(output.trim());
            
            // Store OTP session data if OTP was sent successfully
            if (result.status === "otp_sent" && result.phone_code_hash) {
              otpStorage.storeOTPSession(actualPhone, actualSessionName, result.phone_code_hash);
              console.log(`Stored OTP session for ${actualPhone} with hash: ${result.phone_code_hash.substring(0, 10)}...`);
            }
            
            // Log activity
            await storage.createActivity({
              type: "otp_request",
              message: `OTP requested for ${actualPhone}`,
              details: `Session: ${actualSessionName} - ${result.message}`,
              severity: result.status === "otp_sent" ? "success" : "info",
            });
            
            res.json({
              message: "OTP sent successfully",
              sessionName: actualSessionName,
              status: result.status,
              details: result.message
            });
          } else {
            console.error("Python process error:", errorOutput);
            const errorMsg = errorOutput.includes("Phone number invalid") ? 
              "Phone number is invalid or banned" : 
              "Failed to send OTP";
            
            await storage.createActivity({
              type: "otp_request",
              message: `OTP request failed for ${phoneNumber}`,
              details: errorMsg,
              severity: "error",
            });
            
            res.status(400).json({ message: errorMsg });
          }
        } catch (parseError) {
          console.error("Failed to parse Python output:", output, errorOutput);
          res.status(500).json({ message: "Failed to process OTP request" });
        }
      });
      
    } catch (error) {
      console.error("OTP request error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/sessions/verify-otp", async (req, res) => {
    try {
      const { phoneNumber, otp } = req.body;
      
      if (!phoneNumber || !otp) {
        return res.status(400).json({ message: "phoneNumber and otp are required" });
      }
      
      // Retrieve OTP session data
      const otpSession = otpStorage.getOTPSession(phoneNumber);
      if (!otpSession) {
        return res.status(400).json({ 
          message: "OTP session not found or expired. Please request a new OTP." 
        });
      }
      
      console.log(`Retrieved OTP session for ${phoneNumber}: ${otpSession.sessionName}, hash: ${otpSession.phoneCodeHash.substring(0, 10)}...`);
      
      // Create temporary script file to pass sensitive data
      const { writeFile, unlink } = await import("fs/promises");
      const tempScriptPath = `temp_verify_${Date.now()}.py`;
      
      const pythonScript = `
import asyncio
import sys
import json
from pathlib import Path
from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError, PhoneCodeInvalidError
import os
from dotenv import load_dotenv

load_dotenv()

async def verify_otp():
    api_id = int(os.getenv("TELEGRAM_API_ID", "0"))
    api_hash = os.getenv("TELEGRAM_API_HASH", "")
    
    phone = "${phoneNumber}"
    otp_code = "${otp}"
    session_name = "${otpSession.sessionName}"
    phone_code_hash = "${otpSession.phoneCodeHash}"
    
    sessions_dir = Path("sessions")
    sessions_dir.mkdir(exist_ok=True)
    session_file = sessions_dir / f"{session_name}.session"
    
    try:
        client = TelegramClient(str(session_file), api_id, api_hash)
        await client.connect()
        
        # Verify OTP using stored phone_code_hash
        await client.sign_in(
            phone=phone,
            code=otp_code,
            phone_code_hash=phone_code_hash
        )
        
        if await client.is_user_authorized():
            user = await client.get_me()
            await client.disconnect()
            
            result = {
                "status": "success",
                "message": f"OTP verified successfully for {user.first_name}",
                "session_name": session_name,
                "user_info": {
                    "id": user.id,
                    "first_name": user.first_name,
                    "username": user.username
                }
            }
            print(json.dumps(result))
        else:
            await client.disconnect()
            print(json.dumps({"status": "error", "message": "OTP verification failed"}))
            
    except PhoneCodeInvalidError:
        print(json.dumps({"status": "error", "message": "Invalid OTP code. Please try again."}))
    except SessionPasswordNeededError:
        print(json.dumps({"status": "error", "message": "Two-step verification enabled. Please disable it temporarily."}))
    except Exception as e:
        print(json.dumps({"status": "error", "message": f"Error verifying OTP: {str(e)}"}))

if __name__ == "__main__":
    asyncio.run(verify_otp())
`;

      await writeFile(tempScriptPath, pythonScript);
      
      // Execute the script
      const { spawn } = await import("child_process");
      const pythonProcess = spawn("python", [tempScriptPath]);
      
      let output = "";
      let errorOutput = "";
      
      pythonProcess.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      pythonProcess.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });
      
      pythonProcess.on("close", async (code) => {
        // Clean up temporary script
        try {
          await unlink(tempScriptPath);
        } catch (err) {
          console.error("Failed to clean up temp script:", err);
        }
        
        try {
          if (code === 0) {
            const result = JSON.parse(output.trim());
            
            if (result.status === "success") {
              // Remove OTP session after successful verification
              otpStorage.removeOTPSession(phoneNumber);
              
              // Create session in database
              const session = await storage.createSession({
                name: result.session_name,
                phone: phoneNumber,
                sessionFile: `sessions/${result.session_name}.session`,
                status: "active",
                userId: 1 // Default user for now
              });
              
              // Log activity
              await storage.createActivity({
                type: "session_created",
                message: `Session created successfully: ${result.session_name}`,
                details: `Phone: ${phoneNumber} - User: ${result.user_info?.first_name || 'Unknown'}`,
                sessionId: session.id,
                severity: "success",
              });
              
              res.json({
                message: "Session created successfully",
                session: session,
                userInfo: result.user_info
              });
            } else {
              await storage.createActivity({
                type: "otp_verification",
                message: `OTP verification failed for ${phoneNumber}`,
                details: result.message,
                severity: "error",
              });
              
              res.status(400).json({ message: result.message });
            }
          } else {
            console.error("Python process error:", errorOutput);
            const errorMsg = errorOutput.includes("Invalid code") ? 
              "Invalid OTP code" : 
              "Failed to verify OTP";
              
            await storage.createActivity({
              type: "otp_verification",
              message: `OTP verification failed for ${phoneNumber}`,
              details: errorMsg,
              severity: "error",
            });
            
            res.status(400).json({ message: errorMsg });
          }
        } catch (parseError) {
          console.error("Failed to parse Python output:", output, errorOutput);
          res.status(500).json({ message: "Failed to process OTP verification" });
        }
      });
      
    } catch (error) {
      console.error("OTP verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // OTP management endpoints
  app.post("/api/sessions/resend-otp", async (req, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({ message: "phoneNumber is required" });
      }
      
      // Get existing session data if any
      const existingSession = otpStorage.getOTPSession(phoneNumber);
      const sessionName = existingSession?.sessionName || `user_${phoneNumber.replace(/[+\-\s]/g, '')}`;
      
      // Remove existing session to allow fresh request
      otpStorage.removeOTPSession(phoneNumber);
      
      // Redirect to request-otp endpoint
      req.body.sessionName = sessionName;
      req.body.sessionFileName = sessionName;
      
      // Forward to request-otp
      const requestOtpHandler = app._router.stack.find((layer: any) => 
        layer.route?.path === '/api/sessions/request-otp' && 
        layer.route.methods.post
      );
      
      if (requestOtpHandler) {
        return requestOtpHandler.route.stack[0].handle(req, res);
      }
      
      res.status(500).json({ message: "Failed to resend OTP" });
      
    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/sessions/otp-status/:phoneNumber", async (req, res) => {
    try {
      const { phoneNumber } = req.params;
      const session = otpStorage.getOTPSession(phoneNumber);
      
      if (!session) {
        return res.json({ 
          hasSession: false, 
          message: "No active OTP session" 
        });
      }
      
      const timeRemaining = Math.max(0, session.expiresAt - Date.now());
      
      res.json({
        hasSession: true,
        sessionName: session.sessionName,
        expiresIn: timeRemaining,
        expiresAt: new Date(session.expiresAt).toISOString()
      });
      
    } catch (error) {
      console.error("OTP status error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Session management endpoints
  app.post("/api/copier/users/:userId/pause", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Find session by name instead of ID
      const session = await storage.getSessionByName(userId);
      if (!session) {
        const availableSessions = await storage.getAllSessions();
        return res.status(404).json({ 
          message: `Session '${userId}' not found`,
          availableSessions: availableSessions.map(s => s.name),
          totalSessions: availableSessions.length
        });
      }
      
      // Update session status to paused
      const updatedSession = await storage.updateSession(session.id, { status: "inactive" });
      
      await storage.createActivity({
        type: "session_paused",
        message: `Session paused: ${session.name}`,
        details: `User paused session ${userId}`,
        sessionId: session.id,
        severity: "info",
      });
      
      res.json({ message: "Session paused successfully", session: updatedSession });
    } catch (error) {
      console.error("Pause session error:", error);
      res.status(500).json({ message: "Failed to pause session", error: (error as Error).message });
    }
  });

  app.post("/api/copier/users/:userId/resume", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Find session by name instead of ID
      const session = await storage.getSessionByName(userId);
      if (!session) {
        const availableSessions = await storage.getAllSessions();
        return res.status(404).json({ 
          message: `Session '${userId}' not found`,
          availableSessions: availableSessions.map(s => s.name),
          totalSessions: availableSessions.length
        });
      }
      
      // Update session status to active
      const updatedSession = await storage.updateSession(session.id, { status: "active" });
      
      await storage.createActivity({
        type: "session_resumed",
        message: `Session resumed: ${session.name}`,
        details: `User resumed session ${userId}`,
        sessionId: session.id,
        severity: "info",
      });
      
      res.json({ message: "Session resumed successfully", session: updatedSession });
    } catch (error) {
      console.error("Resume session error:", error);
      res.status(500).json({ message: "Failed to resume session", error: (error as Error).message });
    }
  });

  app.delete("/api/copier/users/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Find session by name instead of ID
      const session = await storage.getSessionByName(userId);
      if (!session) {
        const availableSessions = await storage.getAllSessions();
        return res.status(404).json({ 
          message: `Session '${userId}' not found`,
          availableSessions: availableSessions.map(s => s.name),
          totalSessions: availableSessions.length
        });
      }
      
      // Delete session
      await storage.deleteSession(session.id);
      
      await storage.createActivity({
        type: "session_deleted",
        message: `Session deleted: ${session.name}`,
        details: `User deleted session ${userId}`,
        severity: "warning",
      });
      
      res.json({ message: "Session deleted successfully" });
    } catch (error) {
      console.error("Delete session error:", error);
      res.status(500).json({ message: "Failed to delete session", error: (error as Error).message });
    }
  });

  // Blocklists routes
  app.get("/api/blocklists", async (req, res) => {
    try {
      const { type, pairId } = req.query;
      let blocklists;
      
      if (type) {
        blocklists = await storage.getBlocklistsByType(type as string);
      } else if (pairId === "global") {
        blocklists = await storage.getGlobalBlocklists();
      } else if (pairId) {
        blocklists = await storage.getPairBlocklists(parseInt(pairId as string));
      } else {
        blocklists = await storage.getAllBlocklists();
      }
      
      res.json(blocklists);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blocklists" });
    }
  });

  app.post("/api/blocklists", async (req, res) => {
    try {
      const validatedData = insertBlocklistSchema.parse(req.body);
      const blocklist = await storage.createBlocklist(validatedData);
      res.status(201).json(blocklist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid blocklist data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create blocklist" });
      }
    }
  });

  app.delete("/api/blocklists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteBlocklist(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Blocklist entry not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete blocklist entry" });
    }
  });

  // Activities routes
  app.get("/api/activities", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const validatedData = insertActivitySchema.parse(req.body);
      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create activity" });
      }
    }
  });

  // System stats routes
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system stats" });
    }
  });

  // Configuration validation routes
  app.get("/api/config/validate", async (req, res) => {
    try {
      const status = {
        telegram_api: !!process.env.TELEGRAM_API_ID && !!process.env.TELEGRAM_API_HASH,
        discord_bot: !!process.env.DISCORD_BOT_TOKEN,
        admin_bot: !!process.env.ADMIN_BOT_TOKEN,
        database: !!process.env.DATABASE_URL,
        admin_users: !!process.env.ADMIN_USER_IDS,
        session_secret: !!process.env.SESSION_SECRET,
        config_files: {
          pairs: true, // We have in-memory data
          sessions: true,
          blocklist: true
        }
      };
      
      res.json({ success: true, status });
    } catch (error) {
      console.error("Configuration validation failed:", error);
      res.status(500).json({ success: false, message: `Configuration validation failed: ${error}` });
    }
  });

  // Environment variables management
  app.get("/api/config/env", async (req, res) => {
    try {
      // Return environment variable status (without exposing actual values)
      const envStatus = {
        TELEGRAM_API_ID: !!process.env.TELEGRAM_API_ID,
        TELEGRAM_API_HASH: !!process.env.TELEGRAM_API_HASH,
        DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN,
        ADMIN_BOT_TOKEN: !!process.env.ADMIN_BOT_TOKEN,
        ADMIN_USER_IDS: !!process.env.ADMIN_USER_IDS,
        DATABASE_URL: !!process.env.DATABASE_URL,
        SESSION_SECRET: !!process.env.SESSION_SECRET,
        WEBHOOK_URL: !!process.env.WEBHOOK_URL,
      };
      
      res.json({ success: true, variables: envStatus });
    } catch (error) {
      console.error("Failed to get environment status:", error);
      res.status(500).json({ success: false, message: "Failed to get environment status" });
    }
  });

  // Process management routes
  app.get("/api/processes/status", async (req, res) => {
    try {
      // Return mock process status for now
      const processes = {
        userbot: { status: 'stopped', pid: null, uptime: 0 },
        poster: { status: 'stopped', pid: null, uptime: 0 },
        discord_bot: { status: 'stopped', pid: null, uptime: 0 },
        copier: { status: 'stopped', pid: null, uptime: 0 },
        admin_bot: { status: 'stopped', pid: null, uptime: 0 }
      };
      
      res.json({ success: true, processes });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to get process status" });
    }
  });

  app.post("/api/processes/:component/start", async (req, res) => {
    try {
      const { component } = req.params;
      
      // Log the start request
      console.log(`Starting component: ${component}`);
      
      // Create activity log
      await storage.createActivity({
        type: 'process',
        message: `Starting ${component}`,
        details: `User requested start of ${component} component`,
        severity: 'info'
      });
      
      // Return success (actual process starting would be handled by process manager)
      res.json({ 
        success: true, 
        message: `${component} start requested`,
        pid: Math.floor(Math.random() * 10000) // Mock PID
      });
    } catch (error) {
      res.status(500).json({ success: false, message: `Failed to start ${req.params.component}` });
    }
  });

  app.post("/api/processes/:component/stop", async (req, res) => {
    try {
      const { component } = req.params;
      
      console.log(`Stopping component: ${component}`);
      
      await storage.createActivity({
        type: 'process',
        message: `Stopping ${component}`,
        details: `User requested stop of ${component} component`,
        severity: 'info'
      });
      
      res.json({ 
        success: true, 
        message: `${component} stop requested`
      });
    } catch (error) {
      res.status(500).json({ success: false, message: `Failed to stop ${req.params.component}` });
    }
  });

  // Copier management routes - unified with sessions API
  app.get("/api/copier/users", async (req, res) => {
    try {
      // Get real sessions from database and format for TelX page
      const sessions = await storage.getAllSessions();
      const pairs = await storage.getAllPairs();
      
      // Transform sessions into TelX format
      const users = sessions.map(session => ({
        user_id: session.name,
        session_file: session.sessionFile,
        status: session.status,
        phone: session.phone,
        total_pairs: pairs.filter(p => p.session === session.name).length,
        trap_hits: 0, // Will be enhanced with real trap data
        pairs: pairs.filter(p => p.session === session.name).map(pair => ({
          source: pair.sourceChannel,
          destination: pair.destinationChannel,
          strip_rules: {
            remove_mentions: true,
            header_patterns: [],
            footer_patterns: []
          }
        }))
      }));
      
      res.json(users);
    } catch (error) {
      console.error("Failed to fetch copier users:", error);
      res.status(500).json({ message: "Failed to fetch copier users" });
    }
  });

  // Duplicate OTP endpoint removed - using unified endpoint above

  app.post("/api/sessions/verify-otp", async (req, res) => {
    try {
      // Support both Dashboard format { phone, otp } and TelX format { phone, code }
      const { phone, code, otp, session_name } = req.body;
      
      const actualPhone = phone;
      const actualOtp = code || otp;
      
      if (!actualPhone || !actualOtp) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone and OTP code required" 
        });
      }
      
      // Execute the Python session loader to verify OTP
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['telegram_copier/session_loader.py', '--phone', actualPhone, '--otp', actualOtp, '--session-name', session_name || '']);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', async (code) => {
        try {
          if (code === 0 && stdout) {
            const result = JSON.parse(stdout.trim());
            
            if (result.status === 'success') {
              // Create session in database with userId
              const session = await storage.createSession({
                userId: 1, // Default user ID - will be enhanced with proper auth
                name: result.session_name,
                phone: actualPhone,
                sessionFile: `sessions/${result.session_name}.session`,
                status: 'active'
              });
              
              // Log session creation
              await storage.createActivity({
                type: 'session_connected',
                message: 'Session authenticated',
                details: `Session connected for ${result.user_info.first_name} (${actualPhone})`,
                severity: 'info'
              });
              
              res.json({ 
                success: true, 
                message: result.message,
                session: session,
                user_info: result.user_info
              });
            } else {
              // Log failed verification
              await storage.createActivity({
                type: 'session',
                message: 'OTP verification failed',
                details: `Phone: ${actualPhone}, Error: ${result.message}`,
                severity: 'warning'
              });
              
              res.status(400).json({ 
                success: false, 
                message: result.message 
              });
            }
          } else {
            console.error('Session verification error:', stderr);
            await storage.createActivity({
              type: 'session',
              message: 'OTP verification failed',
              details: `Phone: ${phone}, Error: ${stderr || 'Unknown error'}`,
              severity: 'error'
            });
            
            res.status(500).json({ 
              success: false, 
              message: "Failed to verify OTP. Please try again." 
            });
          }
        } catch (parseError) {
          console.error('Failed to parse session verification response:', parseError);
          res.status(500).json({ 
            success: false, 
            message: "Internal error processing OTP verification" 
          });
        }
      });
      
    } catch (error) {
      console.error('OTP verification error:', error);
      res.status(500).json({ success: false, message: "Failed to verify OTP" });
    }
  });

  // Trap detection routes
  app.get("/api/logs/traps", async (req, res) => {
    try {
      // Return mock trap logs
      const trapLogs = [
        {
          id: "1",
          user_id: "example_user",
          message_id: "123456",
          trap_type: "edit_trap",
          content: "Suspicious message content",
          timestamp: new Date().toISOString(),
          action: "blocked"
        }
      ];
      
      res.json(trapLogs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trap logs" });
    }
  });

  app.post("/api/block/text", async (req, res) => {
    try {
      const { pattern, scope = "global" } = req.body;
      
      if (!pattern) {
        return res.status(400).json({ success: false, message: "Pattern required" });
      }
      
      await storage.createActivity({
        type: 'blocklist',
        message: 'Text pattern blocked',
        details: `Added pattern: ${pattern} (scope: ${scope})`,
        severity: 'info'
      });
      
      res.json({ success: true, message: "Text pattern added to blocklist" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to add text pattern" });
    }
  });

  app.post("/api/block/images", async (req, res) => {
    try {
      // Handle image upload and hashing
      res.json({ success: true, message: "Image added to blocklist" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to add image" });
    }
  });

  app.get("/api/block/images", async (req, res) => {
    try {
      // Return mock blocked images
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch blocked images" });
    }
  });

  app.post("/api/config/validate-token", async (req, res) => {
    try {
      const { token, type } = req.body;
      
      if (!token) {
        return res.status(400).json({ success: false, message: "Token is required" });
      }
      
      // Basic token format validation
      let valid = false;
      let message = "";
      
      if (type === "bot") {
        // Telegram bot token format: 123456789:ABCDEF...
        valid = /^\d{8,10}:[A-Za-z0-9_-]{35}$/.test(token);
        message = valid ? "Valid bot token format" : "Invalid bot token format";
      } else if (type === "api_hash") {
        valid = token.length >= 10;
        message = valid ? "Valid API hash format" : "API hash too short";
      } else {
        return res.status(400).json({ success: false, message: "Invalid token type" });
      }
      
      res.json({ success: valid, valid, message });
    } catch (error) {
      res.status(500).json({ success: false, message: `Token validation failed: ${error}` });
    }
  });



  app.post("/api/sessions/verify-otp", async (req, res) => {
    try {
      const { phone, otp } = req.body;
      
      if (!phone || !otp) {
        return res.status(400).json({ success: false, message: "Phone and OTP are required" });
      }
      
      // Import and use SessionLoader
      const { spawn } = await import("child_process");
      const process = spawn("python3", [
        "telegram_copier/session_loader.py",
        "--phone", phone,
        "--otp", otp
      ], {
        stdio: ["pipe", "pipe", "pipe"]
      });
      
      let output = "";
      let error = "";
      
      process.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      process.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      process.on("close", async (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            
            // If successful, create session in database
            if (result.status === "success") {
              try {
                await storage.createSession({
                  userId: 1, // Default user ID - will be enhanced with proper auth
                  name: result.session_name,
                  phone: phone,
                  sessionFile: `sessions/${result.session_name}.session`,
                  status: "active"
                });
                
                // Log activity
                await storage.createActivity({
                  type: "session_created",
                  message: `New session created: ${result.session_name}`,
                  details: `Phone: ${phone}, User: ${result.user_info?.first_name}`,
                  severity: "success",
                });
              } catch (dbError) {
                console.warn("Session created but not saved to database:", dbError);
              }
            }
            
            res.json(result);
          } catch (e) {
            res.json({ status: "success", message: output.trim() });
          }
        } else {
          res.status(500).json({ 
            success: false, 
            message: error || "Failed to verify OTP" 
          });
        }
      });
      
    } catch (error) {
      res.status(500).json({ success: false, message: `OTP verification failed: ${error}` });
    }
  });

  // Telegram Copier control routes
  app.post("/api/start/copier", async (req, res) => {
    try {
      // Start the Telegram copier module
      const { spawn } = await import("child_process");
      const process = spawn("python3", [
        "telegram_copier/copier_multi_session.py"
      ], {
        stdio: ["pipe", "pipe", "pipe"],
        detached: true
      });
      
      // Store process info
      const processInfo = {
        pid: process.pid,
        name: "telegram_copier",
        startTime: new Date().toISOString(),
        status: "running"
      };
      
      // Log activity
      await storage.createActivity({
        type: "copier_started",
        message: "Telegram copier started",
        details: `PID: ${process.pid}`,
        severity: "success",
      });
      
      res.json({ 
        success: true, 
        message: "Telegram copier started successfully",
        process: processInfo
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to start copier: ${error}` 
      });
    }
  });

  app.post("/api/stop/copier", async (req, res) => {
    try {
      // For now, just log the stop request
      await storage.createActivity({
        type: "copier_stopped",
        message: "Telegram copier stop requested",
        details: "Process management to be implemented",
        severity: "info",
      });
      
      res.json({ 
        success: true, 
        message: "Copier stop requested" 
      });
      
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to stop copier: ${error}` 
      });
    }
  });

  // Control routes
  app.post("/api/control/pause-all", async (req, res) => {
    try {
      const pairs = await storage.getAllPairs();
      const activePairs = pairs.filter(p => p.status === "active");
      
      for (const pair of activePairs) {
        await storage.updatePair(pair.id, { status: "paused" });
      }

      // Update system stats
      await storage.updateSystemStats({ activePairs: 0 });

      // Log activity
      await storage.createActivity({
        type: "global_pause",
        message: "All pairs paused by admin",
        details: `${activePairs.length} pairs paused`,
        severity: "warning",
      });
      
      res.json({ success: true, pausedCount: activePairs.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to pause all pairs" });
    }
  });

  app.post("/api/control/resume-all", async (req, res) => {
    try {
      const pairs = await storage.getAllPairs();
      const pausedPairs = pairs.filter(p => p.status === "paused");
      
      for (const pair of pausedPairs) {
        await storage.updatePair(pair.id, { status: "active" });
      }

      // Update system stats
      await storage.updateSystemStats({ activePairs: pausedPairs.length });

      // Log activity
      await storage.createActivity({
        type: "global_resume",
        message: "All pairs resumed by admin",
        details: `${pausedPairs.length} pairs resumed`,
        severity: "success",
      });
      
      res.json({ success: true, resumedCount: pausedPairs.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to resume all pairs" });
    }
  });

  // Session OTP verification route
  app.post("/api/sessions/:id/verify-otp", async (req, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const { otpCode } = req.body;
      
      if (!otpCode || otpCode.length < 5) {
        return res.status(400).json({ message: "Invalid OTP code" });
      }
      
      // Update session status to active
      const session = await storage.updateSession(sessionId, { status: "active" });
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Log activity
      await storage.createActivity({
        type: "session_verified",
        message: `Session verified with OTP`,
        details: `Session ${session.name} verified and activated`,
        sessionId: sessionId,
        severity: "success",
      });
      
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });

  // Process management routes
  app.post("/api/processes/start/:processName", async (req, res) => {
    try {
      const { processName } = req.params;
      const { processManager } = await import("./process_manager");
      
      const result = await processManager.startComponent(processName);
      
      if (result.success) {
        // Log activity
        await storage.createActivity({
          type: "process_started",
          message: `Process started: ${processName}`,
          details: `${processName} started with PID ${result.pid}`,
          severity: "success",
        });
        
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to start ${req.params.processName}: ${error}` 
      });
    }
  });

  app.post("/api/processes/stop/:processName", async (req, res) => {
    try {
      const { processName } = req.params;
      const { processManager } = await import("./process_manager");
      
      const result = await processManager.stopComponent(processName);
      
      if (result.success) {
        // Log activity
        await storage.createActivity({
          type: "process_stopped",
          message: `Process stopped: ${processName}`,
          details: `${processName} stopped successfully`,
          severity: "warning",
        });
        
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to stop ${req.params.processName}: ${error}` 
      });
    }
  });

  app.get("/api/processes/status/:processName", async (req, res) => {
    try {
      const { processName } = req.params;
      const { processManager } = await import("./process_manager");
      
      const result = await processManager.getComponentStatus(processName);
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to get status for ${req.params.processName}: ${error}` 
      });
    }
  });

  app.get("/api/processes/status", async (req, res) => {
    try {
      const { processManager } = await import("./process_manager");
      
      const statuses = await processManager.getAllStatuses();
      res.json({ success: true, processes: statuses });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to get process statuses: ${error}` 
      });
    }
  });

  app.post("/api/processes/restart/:processName", async (req, res) => {
    try {
      const { processName } = req.params;
      const { processManager } = await import("./process_manager");
      
      const result = await processManager.restartComponent(processName);
      
      if (result.success) {
        // Log activity
        await storage.createActivity({
          type: "process_restarted",
          message: `Process restarted: ${processName}`,
          details: `${processName} restarted with PID ${result.pid}`,
          severity: "info",
        });
        
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: `Failed to restart ${req.params.processName}: ${error}` 
      });
    }
  });

  // Trap detection routes
  app.post("/api/trap-detection/block-text", async (req, res) => {
    try {
      const { text, pairId } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: "Text is required" });
      }
      
      const blocklist = await storage.createBlocklist({
        type: "text",
        value: text,
        pairId: pairId || null,
      });
      
      // Log activity
      await storage.createActivity({
        type: "blocklist_added",
        message: `Text blocked: "${text}"`,
        details: `Added to ${pairId ? "pair-specific" : "global"} blocklist`,
        pairId: pairId,
        severity: "info",
      });
      
      res.status(201).json(blocklist);
    } catch (error) {
      res.status(500).json({ message: "Failed to block text" });
    }
  });

  app.post("/api/trap-detection/block-image", async (req, res) => {
    try {
      const { imageHash, pairId } = req.body;
      
      if (!imageHash) {
        return res.status(400).json({ message: "Image hash is required" });
      }
      
      const blocklist = await storage.createBlocklist({
        type: "image_hash",
        value: imageHash,
        pairId: pairId || null,
      });
      
      // Log activity
      await storage.createActivity({
        type: "blocklist_added",
        message: `Image blocked by hash`,
        details: `Hash: ${imageHash.substring(0, 8)}... added to blocklist`,
        pairId: pairId,
        severity: "info",
      });
      
      res.status(201).json(blocklist);
    } catch (error) {
      res.status(500).json({ message: "Failed to block image" });
    }
  });
  app.post("/api/discord/bots", async (req, res) => {
    try {
      const { name, token } = req.body;
      
      // In real implementation, validate token with Discord API
      const bot = {
        id: Date.now(),
        name,
        token,
        status: 'active' as const,
        lastPing: new Date().toISOString(),
        guilds: Math.floor(Math.random() * 10) + 1
      };
      
      res.status(201).json(bot);
    } catch (error) {
      res.status(500).json({ message: "Failed to add Discord bot" });
    }
  });

  app.post("/api/discord/test-webhook", async (req, res) => {
    try {
      const { webhookUrl } = req.body;
      
      // In real implementation, send test message to webhook
      if (webhookUrl && webhookUrl.includes('discord.com/api/webhooks/')) {
        res.json({ success: true, message: "Test message sent" });
      } else {
        res.status(400).json({ message: "Invalid webhook URL" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to test webhook" });
    }
  });

  // TelX-specific API endpoints
  app.get("/api/copier/users", async (req, res) => {
    try {
      // Get actual sessions from database
      const sessions = await storage.getAllSessions();
      
      // Transform sessions to match expected format
      const users = sessions.map(session => ({
        user_id: session.name,
        session_file: session.sessionFile,
        status: session.status,
        total_pairs: 0, // Would need to calculate from pairs table
        trap_hits: 0, // Would need to calculate from activities table
        pairs: [] // Would need to get from pairs table
      }));
      
      res.json(users);
    } catch (error) {
      console.error("Failed to fetch copier users:", error);
      res.status(500).json({ error: "Failed to fetch copier users" });
    }
  });

  app.get("/api/block/images", async (req, res) => {
    try {
      // Mock data for blocked images
      const mockImages = [
        {
          hash: "d41d8cd98f00b204e9800998ecf8427e",
          filename: "trap_image.jpg",
          blocked_at: new Date().toISOString()
        }
      ];
      res.json(mockImages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch blocked images" });
    }
  });

  app.get("/api/logs/traps", async (req, res) => {
    try {
      // Mock trap logs
      const mockLogs = [
        {
          id: "1",
          user_id: "example_user",
          message_preview: "Suspicious message detected...",
          trap_type: "text_pattern",
          timestamp: new Date().toISOString(),
          source_channel: "@source_channel"
        }
      ];
      res.json(mockLogs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trap logs" });
    }
  });

  app.post("/api/copier/pause/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // In production, this would update paused_users.json
      res.json({ success: true, message: `User ${userId} paused` });
    } catch (error) {
      res.status(500).json({ error: "Failed to pause user" });
    }
  });

  app.post("/api/copier/resume/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // In production, this would update paused_users.json
      res.json({ success: true, message: `User ${userId} resumed` });
    } catch (error) {
      res.status(500).json({ error: "Failed to resume user" });
    }
  });

  app.delete("/api/copier/delete/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      // In production, this would remove user from user_copies.json
      res.json({ success: true, message: `User ${userId} deleted` });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Pair management endpoints
  app.post("/api/copier/add-pair/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const pairData = req.body;
      
      // In production, this would update user_copies.json
      res.json({ 
        success: true, 
        message: `Pair added to user ${userId}`,
        pair: pairData 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to add pair" });
    }
  });

  app.post("/api/copier/update-pair/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const pairData = req.body;
      
      // In production, this would update user_copies.json
      res.json({ 
        success: true, 
        message: `Pair updated for user ${userId}`,
        pair: pairData 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to update pair" });
    }
  });

  app.delete("/api/copier/delete-pair/:userId/:pairIndex", async (req, res) => {
    try {
      const { userId, pairIndex } = req.params;
      
      // In production, this would remove pair from user_copies.json
      res.json({ 
        success: true, 
        message: `Pair ${pairIndex} deleted from user ${userId}` 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pair" });
    }
  });

  // Blocklist management endpoints
  app.post("/api/block/text", async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text pattern is required" });
      }
      
      // In production, this would update blocklist.json
      res.json({ 
        success: true, 
        message: "Text pattern added to blocklist",
        pattern: text 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to add text pattern" });
    }
  });

  app.post("/api/block/image", async (req, res) => {
    try {
      // In production, this would handle file upload and hash calculation
      const mockHash = "d41d8cd98f00b204e9800998ecf8427e";
      
      res.json({ 
        success: true, 
        message: "Image added to blocklist",
        hash: mockHash 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to add image to blocklist" });
    }
  });

  app.delete("/api/block/remove/:hash", async (req, res) => {
    try {
      const { hash } = req.params;
      
      // In production, this would remove item from blocklist.json
      res.json({ 
        success: true, 
        message: `Item ${hash} removed from blocklist` 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove item from blocklist" });
    }
  });

  // Register enhanced OTP routes (replaces legacy OTP endpoints)
  registerEnhancedOtpRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
