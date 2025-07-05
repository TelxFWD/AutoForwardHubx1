import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authStorage } from "./auth-storage";
import { insertPairSchema, insertSessionSchema, insertBlocklistSchema, insertActivitySchema, pinLoginSchema, createUserSchema } from "@shared/schema";
import { z } from "zod";
import { body, validationResult } from "express-validator";
import { 
  securityMiddleware, 
  authRateLimit, 
  apiRateLimit, 
  validatePIN, 
  validateSession, 
  errorHandler, 
  healthCheck 
} from "./production-fixes";

// Enhanced authentication middleware with security
function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '') || 
                req.body.sessionToken || 
                req.cookies?.sessionToken;
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  authStorage.validateSession(token).then(user => {
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }
    req.user = user;
    next();
  }).catch(error => {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  });
}

// Enhanced admin middleware with proper security
function requireAdmin(req: any, res: any, next: any) {
  // First check if user is authenticated
  requireAuth(req, res, () => {
    // Then check if user has admin privileges (PIN 0000)
    if (req.user?.pin !== '0000') {
      return res.status(403).json({ 
        success: false, 
        message: 'Admin privileges required',
        code: 'ADMIN_REQUIRED'
      });
    }
    next();
  });
}

// Input validation middleware
function validateInput(validations: any[]) {
  return async (req: any, res: any, next: any) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid input data',
        errors: errors.array()
      });
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply security middleware
  app.use(securityMiddleware);
  
  // Health check endpoint
  app.get('/health', healthCheck);
  
  // Authentication routes with rate limiting
  app.post('/api/auth/login', 
    authRateLimit,
    validateInput([
      body('pin').isLength({ min: 4, max: 4 }).isNumeric().withMessage('PIN must be exactly 4 digits')
    ]),
    async (req, res) => {
      try {
        const { pin } = req.body;
        
        const pinValidation = validatePIN(pin);
        if (!pinValidation.valid) {
          return res.status(400).json({
            success: false,
            message: pinValidation.error
          });
        }
        
        const user = await authStorage.authenticateUser(pin);
        if (!user) {
          // Add delay to prevent brute force attacks
          await new Promise(resolve => setTimeout(resolve, 1000));
          return res.status(401).json({
            success: false,
            message: 'Invalid PIN'
          });
        }
        
        const session = await authStorage.createUserSession(user.id);
        
        res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: user.id,
            pin: user.pin,
            displayName: user.displayName,
            isActive: user.isActive
          },
          sessionToken: session.sessionToken
        });
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          message: 'Login failed'
        });
      }
    }
  );
  
  app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        await authStorage.deleteSession(token);
      }
      res.json({ success: true, message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, message: 'Logout failed' });
    }
  });
  
  // User management routes
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await authStorage.getAllUsers();
      res.json(users.map(user => ({
        id: user.id,
        pin: user.pin,
        displayName: user.displayName,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      })));
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch users' });
    }
  });
  
  app.post('/api/admin/users', 
    requireAdmin,
    validateInput([
      body('pin').isLength({ min: 4, max: 4 }).isNumeric(),
      body('displayName').optional().isString().trim()
    ]),
    async (req, res) => {
      try {
        const { pin, displayName } = req.body;
        
        // Check if PIN already exists
        const existingUser = await authStorage.getUserByPin(pin);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'PIN already exists'
          });
        }
        
        const user = await authStorage.createUser({ pin, displayName });
        res.status(201).json({
          success: true,
          message: 'User created successfully',
          user: {
            id: user.id,
            pin: user.pin,
            displayName: user.displayName,
            isActive: user.isActive
          }
        });
      } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Failed to create user' });
      }
    }
  );
  
  // Dashboard routes with proper user isolation
  app.get('/api/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const [pairs, sessions, activities, systemStats] = await Promise.all([
        storage.getAllPairs(userId),
        storage.getAllSessions(userId),
        storage.getRecentActivities(10),
        storage.getSystemStats()
      ]);
      
      res.json({
        activePairs: pairs.filter(p => p.status === 'active').length,
        totalPairs: pairs.length,
        activeSessions: sessions.filter(s => s.status === 'active').length,
        totalSessions: sessions.length,
        recentActivities: activities,
        systemStats: systemStats || {
          activePairs: 0,
          totalMessages: 0,
          blockedMessages: 0,
          activeSessions: 0,
          lastUpdated: new Date()
        }
      });
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch stats' });
    }
  });
  
  // Pairs management with user isolation
  app.get('/api/pairs', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const pairs = await storage.getAllPairs(userId);
      res.json(pairs);
    } catch (error) {
      console.error('Get pairs error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch pairs' });
    }
  });
  
  app.post('/api/pairs', 
    requireAuth,
    validateInput([
      body('name').isString().trim().isLength({ min: 1, max: 100 }),
      body('sourceChannel').isString().trim().isLength({ min: 1 }),
      body('discordWebhook').isURL(),
      body('destinationChannel').isString().trim().isLength({ min: 1 }),
      body('botToken').isString().trim().isLength({ min: 10 }),
      body('session').isString().trim().isLength({ min: 1 })
    ]),
    async (req, res) => {
      try {
        const userId = req.user.id;
        const pairData = { ...req.body, userId };
        
        const pair = await storage.createPair(pairData);
        
        await storage.createActivity({
          type: 'pair_created',
          message: 'New pair created',
          details: `Pair "${pair.name}" created`,
          pairId: pair.id,
          severity: 'info'
        });
        
        res.status(201).json({
          success: true,
          message: 'Pair created successfully',
          pair
        });
      } catch (error) {
        console.error('Create pair error:', error);
        res.status(500).json({ success: false, message: 'Failed to create pair' });
      }
    }
  );
  
  // Sessions management with user isolation
  app.get('/api/sessions', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const sessions = await storage.getAllSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch sessions' });
    }
  });
  
  // Session OTP request with proper validation
  app.post('/api/sessions/request-otp',
    requireAuth,
    validateInput([
      body('phone').isMobilePhone('any').withMessage('Invalid phone number format')
    ]),
    async (req, res) => {
      try {
        const { phone } = req.body;
        const userId = req.user.id;
        
        // Check if session already exists for this phone
        const existingSession = await storage.getAllSessions(userId);
        const phoneExists = existingSession.some(s => s.phone === phone);
        
        if (phoneExists) {
          return res.status(409).json({
            success: false,
            message: 'Session already exists for this phone number'
          });
        }
        
        // Execute Python session loader
        const { spawn } = await import('child_process');
        const pythonProcess = spawn('python3', ['telegram_copier/session_loader.py', '--phone', phone, '--request-otp']);
        
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
              
              await storage.createActivity({
                type: 'otp_requested',
                message: 'OTP requested',
                details: `OTP sent to ${phone}`,
                severity: 'info'
              });
              
              res.json({
                success: true,
                message: 'OTP sent successfully',
                sessionName: result.session_name || `user_${phone.replace(/\D/g, '')}`
              });
            } else {
              console.error('OTP request failed:', stderr);
              res.status(400).json({
                success: false,
                message: stderr.includes('PHONE_NUMBER_INVALID') 
                  ? 'Invalid phone number' 
                  : 'Failed to send OTP'
              });
            }
          } catch (parseError) {
            console.error('OTP response parse error:', parseError);
            res.status(500).json({
              success: false,
              message: 'OTP request processing failed'
            });
          }
        });
        
        // Timeout handling
        setTimeout(() => {
          pythonProcess.kill();
          res.status(408).json({
            success: false,
            message: 'OTP request timeout'
          });
        }, 30000);
        
      } catch (error) {
        console.error('OTP request error:', error);
        res.status(500).json({ success: false, message: 'OTP request failed' });
      }
    }
  );
  
  // Session OTP verification with security
  app.post('/api/sessions/verify-otp',
    requireAuth,
    validateInput([
      body('phone').isMobilePhone('any'),
      body('code').isNumeric().isLength({ min: 5, max: 6 }),
      body('sessionName').isString().trim().isLength({ min: 1 })
    ]),
    async (req, res) => {
      try {
        const { phone, code, sessionName } = req.body;
        const userId = req.user.id;
        
        // Execute Python session loader
        const { spawn } = await import('child_process');
        const pythonProcess = spawn('python3', ['telegram_copier/session_loader.py', '--phone', phone, '--otp', code, '--session-name', sessionName]);
        
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
                // Create session with proper user isolation
                const session = await storage.createSession({
                  userId,
                  name: result.session_name,
                  phone: phone,
                  sessionFile: `sessions/${result.session_name}.session`,
                  status: 'active'
                });
                
                await storage.createActivity({
                  type: 'session_connected',
                  message: 'Session authenticated',
                  details: `Session connected for ${result.user_info?.first_name || 'user'} (${phone})`,
                  sessionId: session.id,
                  severity: 'info'
                });
                
                res.json({
                  success: true,
                  message: 'Session created successfully',
                  session: {
                    id: session.id,
                    name: session.name,
                    phone: session.phone,
                    status: session.status
                  }
                });
              } else {
                res.status(400).json({
                  success: false,
                  message: result.message || 'OTP verification failed'
                });
              }
            } else {
              console.error('OTP verification failed:', stderr);
              res.status(400).json({
                success: false,
                message: 'Invalid OTP code'
              });
            }
          } catch (parseError) {
            console.error('OTP verification parse error:', parseError);
            res.status(500).json({
              success: false,
              message: 'OTP verification processing failed'
            });
          }
        });
        
        // Timeout handling
        setTimeout(() => {
          pythonProcess.kill();
          res.status(408).json({
            success: false,
            message: 'OTP verification timeout'
          });
        }, 30000);
        
      } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ success: false, message: 'OTP verification failed' });
      }
    }
  );
  
  // Activities feed with pagination
  app.get('/api/activities', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const activities = await storage.getRecentActivities(limit);
      res.json(activities);
    } catch (error) {
      console.error('Get activities error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch activities' });
    }
  });
  
  // Blocklist management
  app.get('/api/blocklists', requireAuth, async (req, res) => {
    try {
      const blocklists = await storage.getAllBlocklists();
      res.json(blocklists);
    } catch (error) {
      console.error('Get blocklists error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch blocklists' });
    }
  });
  
  // Apply global rate limiting to all API routes
  app.use('/api', apiRateLimit);
  
  // Error handling middleware
  app.use(errorHandler);
  
  // Start periodic cleanup of expired sessions
  setInterval(async () => {
    try {
      await authStorage.cleanupExpiredSessions();
    } catch (error) {
      console.error('Session cleanup error:', error);
    }
  }, 60 * 60 * 1000); // Every hour
  
  const httpServer = createServer(app);
  
  // Setup graceful shutdown
  const shutdown = () => {
    console.log('Graceful shutdown initiated...');
    httpServer.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  return httpServer;
}