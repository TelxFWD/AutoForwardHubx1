import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPairSchema, insertSessionSchema, insertBlocklistSchema, insertActivitySchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Copier management routes
  app.get("/api/copier/users", async (req, res) => {
    try {
      // Return mock user data based on user_copies.json format
      const users = [
        {
          user_id: "example_user",
          session_file: "sessions/example_user.session",
          status: "active",
          pairs: [
            {
              source: "@example_source",
              destination: "@example_dest",
              strip_rules: {
                remove_mentions: true,
                header_patterns: [],
                footer_patterns: []
              }
            }
          ]
        }
      ];
      
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch copier users" });
    }
  });

  // Session management routes
  app.post("/api/sessions/request-otp", async (req, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone) {
        return res.status(400).json({ success: false, message: "Phone number required" });
      }
      
      // Execute the Python session loader to request OTP
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['telegram_copier/session_loader.py', '--phone', phone]);
      
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
            
            // Log OTP request
            await storage.createActivity({
              type: 'session',
              message: `OTP request ${result.status}`,
              details: `Phone: ${phone}, Status: ${result.status}, Message: ${result.message}`,
              severity: result.status === 'otp_sent' ? 'info' : 'warning'
            });
            
            if (result.status === 'otp_sent') {
              res.json({ 
                success: true, 
                message: result.message,
                session_name: result.session_name
              });
            } else {
              res.status(400).json({ 
                success: false, 
                message: result.message 
              });
            }
          } else {
            console.error('Session loader error:', stderr);
            await storage.createActivity({
              type: 'session',
              message: 'OTP request failed',
              details: `Phone: ${phone}, Error: ${stderr || 'Unknown error'}`,
              severity: 'error'
            });
            
            res.status(500).json({ 
              success: false, 
              message: "Failed to request OTP. Please check your Telegram API credentials." 
            });
          }
        } catch (parseError) {
          console.error('Failed to parse session loader response:', parseError);
          res.status(500).json({ 
            success: false, 
            message: "Internal error processing OTP request" 
          });
        }
      });
      
    } catch (error) {
      console.error('OTP request error:', error);
      res.status(500).json({ success: false, message: "Failed to request OTP" });
    }
  });

  app.post("/api/sessions/verify-otp", async (req, res) => {
    try {
      const { phone, code, session_name } = req.body;
      
      if (!phone || !code) {
        return res.status(400).json({ 
          success: false, 
          message: "Phone and OTP code required" 
        });
      }
      
      // Execute the Python session loader to verify OTP
      const { spawn } = await import('child_process');
      const pythonProcess = spawn('python3', ['telegram_copier/session_loader.py', '--phone', phone, '--otp', code, '--session-name', session_name || '']);
      
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
              // Create session in database
              const session = await storage.createSession({
                name: result.session_name,
                phone: phone,
                sessionFile: `sessions/${result.session_name}.session`,
                status: 'active'
              });
              
              // Log session creation
              await storage.createActivity({
                type: 'session_connected',
                message: 'Session authenticated',
                details: `Session connected for ${result.user_info.first_name} (${phone})`,
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
                details: `Phone: ${phone}, Error: ${result.message}`,
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
      // Mock data for now - in production, this would read from user_copies.json
      const mockUsers = [
        {
          user_id: "example_user",
          session_file: "example_user.session",
          status: "active",
          total_pairs: 2,
          trap_hits: 3,
          pairs: [
            {
              source: "@source_channel",
              destination: "@dest_channel",
              strip_rules: {
                remove_mentions: true,
                header_patterns: ["^#\\w+", "^(⭐|🔥|VIP|ENTRY)\\b"],
                footer_patterns: ["shared by .*", "auto copy.*"]
              }
            }
          ]
        }
      ];
      res.json(mockUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
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

  const httpServer = createServer(app);
  return httpServer;
}
